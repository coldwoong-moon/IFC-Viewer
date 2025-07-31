#!/usr/bin/env node

/**
 * CHD Viewer Server
 * Simple Express server to serve the CHD viewer and provide CHD file loading API
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { CHDParser } from '../src/parsers/CHDParser.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { IFCToCHDConverter } from '../src/converters/IFCToCHDConverter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Configure multer for file uploads
const upload = multer({ 
    dest: path.join(__dirname, 'uploads/'),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Middleware
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080'], // Explicit origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));
app.use(express.json());
app.use(express.static(__dirname));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve the main viewer page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to upload and process CHD files
app.post('/api/upload-chd', upload.fields([
    { name: 'chdFile', maxCount: 1 },
    { name: 'chdFiles', maxCount: 100 }
]), async (req, res) => {
    console.log('Upload request received');
    
    // Set timeout to 5 minutes
    req.setTimeout(300000);
    res.setTimeout(300000);
    
    try {
        const isFolder = req.body.isFolder === 'true';
        
        if (isFolder) {
            // 폴더 업로드 처리
            if (!req.files || !req.files.chdFiles) {
                console.log('No CHD folder files in request');
                return res.status(400).json({ error: 'No CHD folder files uploaded' });
            }
            
            console.log(`Processing CHD folder with ${req.files.chdFiles.length} files`);
            
            // 임시 폴더 생성
            const tempFolderPath = path.join(__dirname, 'uploads', `chd_folder_${Date.now()}`);
            fs.mkdirSync(tempFolderPath, { recursive: true });
            
            try {
                // 파일들을 올바른 구조로 저장
                for (const file of req.files.chdFiles) {
                    const relativePath = file.originalname;
                    const fullPath = path.join(tempFolderPath, relativePath);
                    const dir = path.dirname(fullPath);
                    
                    // 디렉토리 생성
                    fs.mkdirSync(dir, { recursive: true });
                    
                    // 파일 이동
                    fs.renameSync(file.path, fullPath);
                }
                
                const webModel = await processCHDFile(tempFolderPath);
                
                // 임시 폴더 정리
                fs.rmSync(tempFolderPath, { recursive: true, force: true });
                
                console.log('Successfully processed CHD folder, sending response');
                res.json(webModel);
                
            } catch (error) {
                // 임시 폴더 정리
                if (fs.existsSync(tempFolderPath)) {
                    fs.rmSync(tempFolderPath, { recursive: true, force: true });
                }
                throw error;
            }
            
        } else {
            // 단일 파일 업로드 처리 (기존 로직)
            if (!req.files || !req.files.chdFile || req.files.chdFile.length === 0) {
                console.log('No file in request');
                return res.status(400).json({ error: 'No file uploaded' });
            }
            
            const uploadedFile = req.files.chdFile[0];
            const uploadedFilePath = uploadedFile.path;
            const originalName = uploadedFile.originalname.toLowerCase();
            
            // 파일 정보는 INFO 레벨로만 출력 (상세 로깅 제거)
            
            let finalFilePath = uploadedFilePath;
            
            // IFC 파일이면 CHD로 변환
            if (originalName.endsWith('.ifc')) {
                console.log(`🔄 IFC file detected: ${uploadedFile.originalname}, converting to CHD...`);
                try {
                    finalFilePath = await convertIFCtoCHD(uploadedFilePath, uploadedFile.originalname);
                    console.log(`✅ IFC conversion successful: ${finalFilePath}`);
                } catch (conversionError) {
                    console.error(`❌ IFC conversion failed:`, conversionError.message);
                    throw conversionError;
                }
            }
            
            console.log(`📊 Processing CHD file: ${finalFilePath}`);
            const webModel = await processCHDFile(finalFilePath);
            console.log(`✅ CHD processing completed. Elements: ${webModel.statistics?.total_elements || 'unknown'}`);
            
            // Clean up uploaded files
            fs.unlinkSync(uploadedFilePath);
            if (finalFilePath !== uploadedFilePath && fs.existsSync(finalFilePath)) {
                // CHD 변환 파일 정리 (디렉토리인 경우)
                if (fs.statSync(finalFilePath).isDirectory()) {
                    await fs.promises.rm(finalFilePath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(finalFilePath);
                }
            }
            
            console.log('Successfully processed file, sending response');
            res.json(webModel);
        }
        
    } catch (error) {
        console.error('Failed to process uploaded CHD file:', error);
        
        // Clean up uploaded files on error
        if (req.files) {
            if (req.files.chdFile) {
                req.files.chdFile.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }
            if (req.files.chdFiles) {
                req.files.chdFiles.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }
        }
        
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// API endpoint to load CHD files from disk
app.post('/api/load-chd', async (req, res) => {
    try {
        const { fileName } = req.body;
        
        // Default to test2.chd if no filename provided
        const chdPath = fileName === 'test2.chd' 
            ? '/Users/coldwoong/Downloads/IFC/test2.chd'
            : fileName || '/Users/coldwoong/Downloads/IFC/test2.chd';
        
        console.log(`Loading CHD file from disk: ${chdPath}`);
        
        // Check if file exists
        if (!fs.existsSync(chdPath)) {
            throw new Error(`File not found: ${chdPath}`);
        }
        
        const webModel = await processCHDFile(chdPath);
        
        res.json(webModel);
        
    } catch (error) {
        console.error('Failed to load CHD file:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// API endpoint to upload and convert IFC files
app.post('/api/upload-ifc', upload.single('ifcFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No IFC file uploaded' });
        }
        
        const uploadedFilePath = req.file.path;
        const fileName = req.file.originalname;
        console.log(`Converting uploaded IFC file: ${fileName}`);
        
        // Create temporary CHD output directory
        const tempChdPath = path.join(__dirname, 'uploads', `chd_${Date.now()}`);
        
        try {
            // Convert IFC to CHD
            const converter = new IFCToCHDConverter({
                preserveTransformations: true,
                parseGeometry: true,
                parseAttributes: true,
                parseHierarchy: true
            });
            
            console.log(`Converting ${uploadedFilePath} to ${tempChdPath}`);
            const conversionResult = await converter.convert(uploadedFilePath, tempChdPath);
            
            console.log('IFC conversion completed:', {
                elementsProcessed: conversionResult.elementsProcessed,
                success: conversionResult.success,
                boundingBox: conversionResult.boundingBox
            });
            
            // Process the converted CHD file
            const webModel = await processCHDFile(tempChdPath);
            
            // Clean up temporary files
            fs.unlinkSync(uploadedFilePath);
            if (fs.existsSync(tempChdPath)) {
                fs.rmSync(tempChdPath, { recursive: true, force: true });
            }
            
            res.json({
                ...webModel,
                conversionInfo: {
                    originalFile: fileName,
                    convertedFrom: 'IFC',
                    statistics: conversionResult.statistics
                }
            });
            
        } catch (conversionError) {
            console.error('IFC conversion failed:', conversionError);
            
            // Clean up files on error
            if (fs.existsSync(uploadedFilePath)) {
                fs.unlinkSync(uploadedFilePath);
            }
            if (fs.existsSync(tempChdPath)) {
                fs.rmSync(tempChdPath, { recursive: true, force: true });
            }
            
            throw new Error(`IFC conversion failed: ${conversionError.message}`);
        }
        
    } catch (error) {
        console.error('Failed to process uploaded IFC file:', error);
        
        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Helper function to convert IFC to CHD
async function convertIFCtoCHD(ifcFilePath, originalName) {
    const converter = new IFCToCHDConverter({ verbose: false });
    
    // 임시 CHD 출력 디렉토리 생성
    const tempChdDir = path.join(__dirname, 'uploads', `temp_${Date.now()}_${path.basename(originalName, '.ifc')}.chd`);
    
    try {
        // IFC → CHD 변환 시작
        
        // IFC → CHD 변환 실행
        const result = await converter.convert(ifcFilePath, tempChdDir, {
            chunkSize: 100,
            compression: 'zlib',
            compressionLevel: 6
        });
        
        console.log(`✅ IFC → CHD 변환 완료: ${result.totalElements}개 요소`);
        return tempChdDir;
        
    } catch (error) {
        console.error('IFC to CHD conversion failed:', error);
        // 실패 시 임시 디렉토리 정리
        if (fs.existsSync(tempChdDir)) {
            await fs.promises.rm(tempChdDir, { recursive: true, force: true });
        }
        throw new Error(`IFC conversion failed: ${error.message}`);
    }
}

// Helper function to process CHD files
async function processCHDFile(chdPath) {
    // Create parser
    const parser = new CHDParser({
        loadGeometry: true,
        loadAttributes: true,
        loadSpatialIndex: false, // Skip for web performance
        verbose: false // 상세 로깅 비활성화
    });
    
    // Parse CHD file
    const model = await parser.parse(chdPath);
    const stats = parser.getStatistics();
    
    // 성공적으로 파싱 완료 (상세 통계는 제거)
    
    // Convert geometry data to web-friendly format
    const webModel = {
        format: model.format,
        version: model.version,
        project: model.project,
        geometry: {},
        attributes: model.attributes,
        statistics: stats
    };
    
    // Process geometry chunks
    for (const [chunkId, chunk] of Object.entries(model.geometry)) {
        const elements = chunk.getAllElements();
        const webChunk = {
            id: chunkId,
            elements: {},
            statistics: chunk.getStatistics()
        };
        
        // Convert each element
        for (const element of elements) {
            webChunk.elements[element.id] = {
                id: element.id,
                type: element.type,
                vertices: element.vertices,
                faces: element.faces,
                boundingBox: element.boundingBox,
                materialId: element.materialId
            };
        }
        
        webModel.geometry[chunkId] = webChunk;
    }
    
    return webModel;
}

// Start server
app.listen(PORT, () => {
    console.log(`🏗️  CHD Viewer Server running at http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`🔗 API endpoints:`);
    console.log(`   POST /api/load-chd - Load CHD file`);
    console.log(`\n🌐 Open http://localhost:${PORT} to view the CHD viewer`);
});

export default app;