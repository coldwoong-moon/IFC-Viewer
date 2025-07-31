/**
 * CHD Loader for Web Browser
 * Loads and parses CHD files in the browser environment
 */

export class CHDLoader {
    constructor(options = {}) {
        this.options = {
            loadGeometry: true,
            loadAttributes: true,
            loadSpatialIndex: false, // Skip for web viewer performance
            ...options
        };
        
        this.model = null;
        this.chunks = new Map();
        this.materials = new Map();
        this.properties = new Map();
        this.progressCallback = null;
    }

    /**
     * Load CHD from file input or URL
     */
    async loadFromFile(fileOrFiles, progressCallback = null) {
        this.progressCallback = progressCallback;
        
        // 폴더 업로드인지 단일 파일인지 확인
        if (Array.isArray(fileOrFiles)) {
            return await this.loadFromFolder(fileOrFiles);
        }
        
        const file = fileOrFiles;
        
        try {
            this.reportProgress('Reading file...', 5);
            
            // Detect file type
            const fileName = file.name.toLowerCase();
            const isIFC = fileName.endsWith('.ifc');
            const isCHD = fileName.endsWith('.chd');
            
            if (!isIFC && !isCHD) {
                throw new Error('Unsupported file format. Please upload a .chd or .ifc file.');
            }
            
            // Upload file to server for processing
            const formData = new FormData();
            const fieldName = isIFC ? 'ifcFile' : 'chdFile';
            const endpoint = isIFC ? '/api/upload-ifc' : '/api/upload-chd';
            
            formData.append(fieldName, file);
            
            const progressText = isIFC ? 'Converting IFC to CHD...' : 'Processing CHD file...';
            this.reportProgress(progressText, 20);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
            
            this.reportProgress('Processing file...', 50);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            const fileType = isIFC ? 'IFC' : 'CHD';
            console.log(`${fileType} file uploaded and processed:`, file.name);
            
            if (data.conversionInfo) {
                console.log('Conversion info:', data.conversionInfo);
            }
            
            const model = this.processServerResponse(data);
            
            // Add conversion info to model if available
            if (data.conversionInfo) {
                model.conversionInfo = data.conversionInfo;
            }
            
            this.model = model;
            return model;
            
        } catch (error) {
            console.error('Failed to load CHD file:', error);
            // Fallback to demo model if file loading fails
            console.warn('Falling back to demo model');
            const model = await this.createMockModel();
            this.model = model;
            return model;
        }
    }

    /**
     * Load CHD file directly in browser (fallback method)
     */
    async loadFromFileDirectly(file) {
        this.reportProgress('Reading file directly...', 30);
        
        console.log('Direct file loading for:', file.name, 'Type:', file.type, 'Size:', file.size);
        
        try {
            // Check if it's a ZIP file (CHD directory compressed)
            if (file.name.endsWith('.zip') || file.type === 'application/zip') {
                return await this.loadFromZipFile(file);
            }
            
            // Check if it's a binary CHD file
            if (file.name.endsWith('.chd')) {
                return await this.loadFromBinaryFile(file);
            }
            
            // Default: create enhanced mock model based on file info
            return await this.createEnhancedMockModel(file);
            
        } catch (error) {
            console.error('Error in direct file loading:', error);
            // Fallback to basic mock
            const model = await this.createMockModel();
            model.project.name = `${file.name} (Fallback)`;
            model.project.description = `Unable to parse ${file.name}, showing demo data`;
            return model;
        }
    }

    /**
     * Load CHD from ZIP file (compressed CHD directory)
     */
    async loadFromZipFile(file) {
        this.reportProgress('Extracting ZIP file...', 40);
        
        // For now, return enhanced mock until we implement JSZip
        console.log('ZIP file detected, using enhanced mock for now');
        const model = await this.createEnhancedMockModel(file);
        model.project.name = `${file.name} (ZIP Archive)`;
        model.project.description = `CHD archive: ${file.name}`;
        return model;
    }

    /**
     * Load CHD from binary file
     */
    async loadFromBinaryFile(file) {
        this.reportProgress('Reading binary CHD file...', 50);
        
        try {
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            const dataView = new DataView(arrayBuffer);
            
            // Read magic number (first 4 bytes should be 'CHDG' or 'CHD\0')
            const magic = String.fromCharCode(
                dataView.getUint8(0),
                dataView.getUint8(1),
                dataView.getUint8(2),
                dataView.getUint8(3)
            );
            
            console.log('File magic number:', magic);
            
            if (magic === 'CHDG' || magic.startsWith('CHD')) {
                // Basic binary CHD parsing
                return await this.parseBinaryCHD(dataView, file);
            } else {
                console.warn('Invalid CHD magic number, using enhanced mock');
                return await this.createEnhancedMockModel(file);
            }
            
        } catch (error) {
            console.error('Binary file reading failed:', error);
            return await this.createEnhancedMockModel(file);
        }
    }

    /**
     * Parse binary CHD file
     */
    async parseBinaryCHD(dataView, file) {
        this.reportProgress('Parsing CHD binary format...', 70);
        
        // Basic CHD binary parsing (simplified)
        const model = {
            format: 'CHD',
            version: '1.0',
            project: {
                name: file.name.replace('.chd', ''),
                description: `Binary CHD file: ${file.name}`,
                units: 'millimeters',
                coordinate_system: 'local',
                bounding_box: {
                    min: [-1000, -1000, -1000],
                    max: [1000, 1000, 1000]
                }
            },
            geometry: {},
            attributes: {
                materials: { materials: {} },
                properties: { elements: {} }
            },
            statistics: {
                total_elements: 0,
                total_vertices: 0,
                total_faces: 0
            }
        };

        try {
            // Try to read basic header information
            if (dataView.byteLength > 32) {
                const version = dataView.getUint32(4, true);
                const elementCount = dataView.getUint32(12, true);
                const vertexCount = dataView.getUint32(16, true);
                const faceCount = dataView.getUint32(20, true);
                
                console.log(`CHD File Stats: Version=${version}, Elements=${elementCount}, Vertices=${vertexCount}, Faces=${faceCount}`);
                
                model.statistics = {
                    total_elements: elementCount,
                    total_vertices: vertexCount,
                    total_faces: faceCount
                };
                
                // Create geometry based on detected stats
                const chunk = this.createStatsBasedGeometry(elementCount, vertexCount);
                model.geometry['001'] = chunk;
            }
        } catch (parseError) {
            console.warn('CHD parsing error, using basic mock:', parseError);
            const chunk = this.createBasicGeometry();
            model.geometry['001'] = chunk;
        }

        return model;
    }

    /**
     * Create enhanced mock model based on file information
     */
    async createEnhancedMockModel(file) {
        this.reportProgress('Creating enhanced model...', 60);
        
        const model = await this.createMockModel();
        
        // Enhance based on file properties
        model.project.name = file.name.replace(/\.(chd|zip)$/, '');
        model.project.description = `File: ${file.name} (${this.formatFileSize(file.size)})`;
        
        // Scale complexity based on file size
        const sizeMB = file.size / (1024 * 1024);
        const complexityFactor = Math.min(Math.max(sizeMB / 10, 0.5), 3.0);
        
        // Adjust geometry complexity
        const baseElementCount = Object.keys(model.geometry['001'].elements).length;
        const newElementCount = Math.floor(baseElementCount * complexityFactor);
        
        console.log(`Scaling model complexity by ${complexityFactor}x (${newElementCount} elements)`);
        
        // Recreate geometry with appropriate complexity
        model.geometry = {};
        model.attributes.properties.elements = {};
        
        this.createScaledGeometry(model, newElementCount);
        
        return model;
    }

    /**
     * Create geometry based on detected file statistics
     */
    createStatsBasedGeometry(elementCount, vertexCount) {
        const chunk = {
            id: '001',
            elements: {},
            statistics: { elementCount, vertexCount, faceCount: elementCount * 12 }
        };

        // Create simplified elements based on stats
        const elementsToCreate = Math.min(elementCount, 100); // Limit for performance
        
        for (let i = 0; i < elementsToCreate; i++) {
            const elementId = `element_${i + 1}`;
            const x = (i % 10) * 50 - 225;
            const z = Math.floor(i / 10) * 50 - 225;
            
            chunk.elements[elementId] = this.createSimpleElement(elementId, x, 0, z);
        }

        return chunk;
    }

    /**
     * Create scaled geometry based on complexity factor
     */
    createScaledGeometry(model, targetElementCount) {
        const chunk = {
            id: '001',
            elements: {},
            statistics: { elementCount: 0, vertexCount: 0, faceCount: 0 }
        };

        const elementsToCreate = Math.min(targetElementCount, 200); // Performance limit
        
        // Create different types of elements
        const beamCount = Math.floor(elementsToCreate * 0.5);
        const columnCount = Math.floor(elementsToCreate * 0.3);
        const slabCount = Math.floor(elementsToCreate * 0.2);
        
        let elementIndex = 0;
        
        // Create beams
        for (let i = 0; i < beamCount; i++) {
            const elementId = `beam_${i + 1}`;
            const x = (i % 8) * 60 - 210;
            const z = Math.floor(i / 8) * 60 - 180;
            
            chunk.elements[elementId] = this.createBeamElement(elementId, x, 0, z);
            model.attributes.properties.elements[elementId] = {
                name: `Beam ${i + 1}`,
                type: 'beam',
                level: 'Level 1',
                dimensions: { length: 80, width: 20, height: 30 }
            };
            elementIndex++;
        }
        
        // Create columns
        for (let i = 0; i < columnCount; i++) {
            const elementId = `column_${i + 1}`;
            const x = (i % 6) * 100 - 250;
            const z = Math.floor(i / 6) * 100 - 200;
            
            chunk.elements[elementId] = this.createColumnElement(elementId, x, z);
            model.attributes.properties.elements[elementId] = {
                name: `Column ${i + 1}`,
                type: 'column',
                level: 'Level 1',
                dimensions: { width: 30, depth: 30, height: 300 }
            };
            elementIndex++;
        }
        
        // Create slabs
        for (let i = 0; i < slabCount; i++) {
            const elementId = `slab_${i + 1}`;
            const x = (i % 4) * 150 - 225;
            const z = Math.floor(i / 4) * 150 - 225;
            
            chunk.elements[elementId] = this.createSlabElement(elementId, x, z);
            model.attributes.properties.elements[elementId] = {
                name: `Slab ${i + 1}`,
                type: 'slab',
                level: 'Level 1',
                dimensions: { length: 120, width: 120, thickness: 20 }
            };
            elementIndex++;
        }

        // Update statistics
        let totalVertices = 0;
        let totalFaces = 0;
        for (const element of Object.values(chunk.elements)) {
            totalVertices += element.vertices.length;
            totalFaces += element.faces.length;
        }

        chunk.statistics = { 
            elementCount: Object.keys(chunk.elements).length, 
            vertexCount: totalVertices, 
            faceCount: totalFaces 
        };
        
        model.statistics = { 
            total_elements: chunk.statistics.elementCount, 
            total_vertices: totalVertices, 
            total_faces: totalFaces 
        };
        
        model.geometry['001'] = chunk;
    }

    /**
     * Create a simple geometric element
     */
    createSimpleElement(id, x, y, z) {
        const size = 20;
        return {
            id: id,
            type: 'block',
            vertices: [
                [x, y, z], [x + size, y, z], [x + size, y + size, z], [x, y + size, z],
                [x, y, z + size], [x + size, y, z + size], [x + size, y + size, z + size], [x, y + size, z + size]
            ],
            faces: [
                [0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6],
                [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2],
                [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]
            ],
            boundingBox: {
                min: [x, y, z],
                max: [x + size, y + size, z + size]
            },
            materialId: 'concrete'
        };
    }

    /**
     * Create basic geometry chunk for fallback
     */
    createBasicGeometry() {
        const chunk = {
            id: '001',
            elements: {},
            statistics: { elementCount: 0, vertexCount: 0, faceCount: 0 }
        };

        // Create a simple cube as fallback
        chunk.elements['basic_cube'] = this.createSimpleElement('basic_cube', 0, 0, 0);
        
        const totalVertices = chunk.elements['basic_cube'].vertices.length;
        const totalFaces = chunk.elements['basic_cube'].faces.length;
        
        chunk.statistics = { 
            elementCount: 1, 
            vertexCount: totalVertices, 
            faceCount: totalFaces 
        };

        return chunk;
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Try multiple fetch strategies for browser compatibility
     */
    async tryMultipleFetchStrategies(url, options) {
        const strategies = [
            // Strategy 1: Relative URL with CORS
            () => fetch(url, {
                ...options,
                mode: 'cors',
                credentials: 'same-origin'
            }),
            
            // Strategy 2: Absolute localhost URL
            () => fetch(`http://localhost:8080${url}`, {
                ...options,
                mode: 'cors'
            }),
            
            // Strategy 3: 127.0.0.1 instead of localhost
            () => fetch(`http://127.0.0.1:8080${url}`, {
                ...options,
                mode: 'cors'
            }),
            
            // Strategy 4: No-cors mode (limited functionality)
            () => fetch(url, {
                ...options,
                mode: 'no-cors'
            })
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                console.log(`Trying fetch strategy ${i + 1}...`);
                const response = await strategies[i]();
                console.log(`Strategy ${i + 1} succeeded`);
                return response;
            } catch (error) {
                console.warn(`Strategy ${i + 1} failed:`, error.message);
                if (i === strategies.length - 1) {
                    throw error; // Last strategy failed, rethrow error
                }
            }
        }
    }

    /**
     * Load CHD from folder (multiple files)
     */
    async loadFromFolder(files) {
        try {
            this.reportProgress('Processing CHD folder...', 10);
            
            // CHD 폴더 구조 확인
            const manifestFile = files.find(f => f.name === 'manifest.json');
            if (!manifestFile) {
                throw new Error('CHD folder must contain manifest.json');
            }
            
            this.reportProgress('Reading manifest...', 20);
            
            // manifest.json 읽기
            const manifestText = await this.readFileAsText(manifestFile);
            const manifest = JSON.parse(manifestText);
            
            this.reportProgress('Loading geometry files...', 40);
            
            // 파일들을 경로별로 정리
            const filesByPath = new Map();
            for (const file of files) {
                const relativePath = file.webkitRelativePath || file.name;
                filesByPath.set(relativePath, file);
            }
            
            // 지오메트리 파일들 로드
            const geometry = await this.loadGeometryFromFiles(filesByPath);
            
            this.reportProgress('Loading attributes...', 60);
            
            // 속성 파일들 로드 (materials.cbor, properties.cbor)
            const attributes = await this.loadAttributesFromFiles(filesByPath);
            
            this.reportProgress('Loading relations...', 80);
            
            // 관계 파일들 로드 (hierarchy.json, references.json)
            const relations = await this.loadRelationsFromFiles(filesByPath);
            
            // 최종 모델 구성
            const model = {
                format: manifest.format || 'CHD',
                version: manifest.version || '1.0',
                project: manifest.project || {},
                geometry: geometry,
                attributes: attributes,
                relations: relations,
                statistics: manifest.statistics || {}
            };
            
            this.reportProgress('Complete', 100);
            console.log('CHD folder loaded successfully');
            
            this.model = model;
            return model;
            
        } catch (error) {
            console.error('Failed to load CHD folder:', error);
            // Fallback to demo model
            console.warn('Falling back to demo model');
            const model = await this.createMockModel();
            this.model = model;
            return model;
        }
    }

    /**
     * Load CHD from server endpoint
     */
    async loadFromServer(endpoint, fileName) {
        try {
            this.reportProgress('Requesting from server...', 10);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    fileName: fileName || 'test2.chd',
                    loadGeometry: this.options.loadGeometry,
                    loadAttributes: this.options.loadAttributes
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            this.reportProgress('Parsing response...', 30);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            console.log('Loaded from server:', data.statistics);
            return this.processServerResponse(data);
            
        } catch (error) {
            console.error('Failed to load from server:', error.message);
            console.warn('Falling back to demo model');
            const model = await this.createMockModel();
            this.model = model;
            return model;
        }
    }

    /**
     * Process server response and organize data
     */
    async processServerResponse(data) {
        this.reportProgress('Processing geometry...', 50);
        
        const model = {
            format: data.format || 'CHD',
            version: data.version || '1.0',
            project: data.project || {},
            geometry: {},
            attributes: data.attributes || {},
            statistics: data.statistics || {}
        };

        // Process geometry chunks
        if (data.geometry) {
            let processed = 0;
            const totalChunks = Object.keys(data.geometry).length;
            
            for (const [chunkId, chunkData] of Object.entries(data.geometry)) {
                const chunk = this.processGeometryChunk(chunkData);
                model.geometry[chunkId] = chunk;
                
                processed++;
                const progress = 50 + (40 * processed / totalChunks);
                this.reportProgress(`Processing chunk ${chunkId}...`, progress);
            }
        }

        this.reportProgress('Finalizing...', 95);
        
        // Process materials
        if (data.attributes && data.attributes.materials) {
            this.processMaterials(data.attributes.materials);
        }

        // Process properties
        if (data.attributes && data.attributes.properties) {
            this.processProperties(data.attributes.properties);
        }

        this.reportProgress('Complete', 100);
        return model;
    }

    /**
     * Process a geometry chunk
     */
    processGeometryChunk(chunkData) {
        const chunk = {
            id: chunkData.id,
            elements: {},
            statistics: chunkData.statistics || {}
        };

        // Process elements in chunk
        if (chunkData.elements) {
            for (const [elementId, elementData] of Object.entries(chunkData.elements)) {
                chunk.elements[elementId] = {
                    id: elementId,
                    type: elementData.type || 'unknown',
                    vertices: elementData.vertices || [],
                    faces: elementData.faces || [],
                    boundingBox: elementData.boundingBox || null,
                    materialId: elementData.materialId || null
                };
            }
        }

        return chunk;
    }

    /**
     * Process materials
     */
    processMaterials(materialsData) {
        if (materialsData.materials) {
            for (const [id, material] of Object.entries(materialsData.materials)) {
                this.materials.set(id, {
                    id: id,
                    name: material.name || id,
                    type: material.type || 'unknown',
                    color: material.properties?.color || [0.7, 0.7, 0.7, 1.0],
                    properties: material.properties || {}
                });
            }
        }
    }

    /**
     * Process element properties
     */
    processProperties(propertiesData) {
        if (propertiesData.elements) {
            for (const [id, props] of Object.entries(propertiesData.elements)) {
                this.properties.set(id, {
                    id: id,
                    name: props.name || id,
                    type: props.type || 'unknown',
                    level: props.level || 'Unknown',
                    dimensions: props.dimensions || {},
                    customProperties: props.custom_properties || {}
                });
            }
        }
    }

    /**
     * Create mock model for demo purposes
     */
    createMockModel() {
        this.reportProgress('Creating demo model...', 50);
        
        // Based on the test2.chd analysis, create a similar structure
        const model = {
            format: 'CHD',
            version: '1.0',
            project: {
                name: 'Demo Building',
                description: 'Demo model based on test2.chd structure',
                units: 'millimeters',
                coordinate_system: 'local',
                bounding_box: {
                    min: [-250, -250, -250],
                    max: [250, 250, 250]
                }
            },
            geometry: {},
            attributes: {
                materials: {
                    materials: {
                        'concrete': {
                            name: 'Concrete',
                            type: 'concrete',
                            properties: {
                                color: [0.7, 0.7, 0.7, 1.0],
                                density: 2400
                            }
                        },
                        'steel': {
                            name: 'Steel',
                            type: 'steel',
                            properties: {
                                color: [0.3, 0.3, 0.3, 1.0],
                                density: 7850
                            }
                        }
                    }
                },
                properties: {
                    elements: {}
                }
            },
            statistics: {
                total_elements: 0,
                total_vertices: 0,
                total_faces: 0
            }
        };

        // Create some demo geometry
        this.createDemoGeometry(model);
        
        this.reportProgress('Demo model ready', 100);
        return model;
    }

    /**
     * Create demo geometry similar to test2.chd structure
     */
    createDemoGeometry(model) {
        const chunk = {
            id: '001',
            elements: {},
            statistics: { elementCount: 0, vertexCount: 0, faceCount: 0 }
        };

        // Create some beams (similar to test2.chd having 417 beams)
        for (let i = 0; i < 20; i++) {
            const elementId = `beam_${i + 1}`;
            const x = (i % 5) * 100 - 200;
            const z = Math.floor(i / 5) * 100 - 150;
            
            chunk.elements[elementId] = this.createBeamElement(elementId, x, 0, z);
            
            // Add properties
            model.attributes.properties.elements[elementId] = {
                name: `Beam ${i + 1}`,
                type: 'beam',
                level: 'Level 1',
                dimensions: { length: 80, width: 20, height: 30 }
            };
        }

        // Create some columns (similar to test2.chd having 37 columns)
        for (let i = 0; i < 9; i++) {
            const elementId = `column_${i + 1}`;
            const x = (i % 3) * 150 - 150;
            const z = Math.floor(i / 3) * 150 - 150;
            
            chunk.elements[elementId] = this.createColumnElement(elementId, x, z);
            
            // Add properties
            model.attributes.properties.elements[elementId] = {
                name: `Column ${i + 1}`,
                type: 'column',
                level: 'Level 1',
                dimensions: { width: 30, depth: 30, height: 300 }
            };
        }

        // Create some slabs (similar to test2.chd having 36 slabs)
        for (let i = 0; i < 4; i++) {
            const elementId = `slab_${i + 1}`;
            const x = (i % 2) * 200 - 100;
            const z = Math.floor(i / 2) * 200 - 100;
            
            chunk.elements[elementId] = this.createSlabElement(elementId, x, z);
            
            // Add properties
            model.attributes.properties.elements[elementId] = {
                name: `Slab ${i + 1}`,
                type: 'slab',
                level: 'Level 1',
                dimensions: { length: 150, width: 150, thickness: 20 }
            };
        }

        // Update statistics
        const totalElements = Object.keys(chunk.elements).length;
        let totalVertices = 0;
        let totalFaces = 0;

        for (const element of Object.values(chunk.elements)) {
            totalVertices += element.vertices.length;
            totalFaces += element.faces.length;
        }

        chunk.statistics = { elementCount: totalElements, vertexCount: totalVertices, faceCount: totalFaces };
        model.statistics = { total_elements: totalElements, total_vertices: totalVertices, total_faces: totalFaces };
        
        model.geometry['001'] = chunk;
    }

    /**
     * Create a beam element
     */
    createBeamElement(id, x, y, z) {
        const width = 20;
        const height = 30;
        const length = 80;
        
        const vertices = [
            // Bottom face
            [x, y, z], [x + length, y, z], [x + length, y + width, z], [x, y + width, z],
            // Top face
            [x, y, z + height], [x + length, y, z + height], [x + length, y + width, z + height], [x, y + width, z + height]
        ];

        const faces = [
            // Bottom
            [0, 1, 2], [0, 2, 3],
            // Top
            [4, 6, 5], [4, 7, 6],
            // Sides
            [0, 4, 5], [0, 5, 1], // front
            [1, 5, 6], [1, 6, 2], // right
            [2, 6, 7], [2, 7, 3], // back
            [3, 7, 4], [3, 4, 0]  // left
        ];

        return {
            id: id,
            type: 'beam',
            vertices: vertices,
            faces: faces,
            boundingBox: {
                min: [x, y, z],
                max: [x + length, y + width, z + height]
            },
            materialId: 'concrete'
        };
    }

    /**
     * Create a column element
     */
    createColumnElement(id, x, z) {
        const width = 30;
        const height = 300;
        const y = 0;
        
        const vertices = [
            // Bottom face
            [x, y, z], [x + width, y, z], [x + width, y + width, z], [x, y + width, z],
            // Top face
            [x, y, z + height], [x + width, y, z + height], [x + width, y + width, z + height], [x, y + width, z + height]
        ];

        const faces = [
            // Bottom
            [0, 1, 2], [0, 2, 3],
            // Top
            [4, 6, 5], [4, 7, 6],
            // Sides
            [0, 4, 5], [0, 5, 1], // front
            [1, 5, 6], [1, 6, 2], // right
            [2, 6, 7], [2, 7, 3], // back
            [3, 7, 4], [3, 4, 0]  // left
        ];

        return {
            id: id,
            type: 'column',
            vertices: vertices,
            faces: faces,
            boundingBox: {
                min: [x, y, z],
                max: [x + width, y + width, z + height]
            },
            materialId: 'concrete'
        };
    }

    /**
     * Create a slab element
     */
    createSlabElement(id, x, z) {
        const width = 150;
        const thickness = 20;
        const y = -250;
        
        const vertices = [
            // Bottom face
            [x, y, z], [x + width, y, z], [x + width, y + width, z], [x, y + width, z],
            // Top face
            [x, y, z + thickness], [x + width, y, z + thickness], [x + width, y + width, z + thickness], [x, y + width, z + thickness]
        ];

        const faces = [
            // Bottom
            [0, 2, 1], [0, 3, 2],
            // Top
            [4, 5, 6], [4, 6, 7],
            // Sides
            [0, 1, 5], [0, 5, 4], // front
            [1, 2, 6], [1, 6, 5], // right
            [2, 3, 7], [2, 7, 6], // back
            [3, 0, 4], [3, 4, 7]  // left
        ];

        return {
            id: id,
            type: 'slab',
            vertices: vertices,
            faces: faces,
            boundingBox: {
                min: [x, y, z],
                max: [x + width, y + width, z + thickness]
            },
            materialId: 'concrete'
        };
    }

    /**
     * Read file as ArrayBuffer
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Report loading progress
     */
    reportProgress(message, percentage) {
        if (this.progressCallback) {
            this.progressCallback({
                message: message,
                percentage: Math.round(percentage),
                timestamp: Date.now()
            });
        }
    }

    /**
     * Get model statistics
     */
    getStatistics() {
        if (!this.model) return null;
        
        return {
            ...this.model.statistics,
            materials: this.materials.size,
            properties: this.properties.size
        };
    }

    /**
     * Get material by ID
     */
    getMaterial(id) {
        return this.materials.get(id);
    }

    /**
     * Get properties by element ID
     */
    getProperties(id) {
        return this.properties.get(id);
    }

    /**
     * Get all elements
     */
    getAllElements() {
        if (!this.model || !this.model.geometry) return [];
        
        const elements = [];
        for (const chunk of Object.values(this.model.geometry)) {
            for (const element of Object.values(chunk.elements)) {
                elements.push(element);
            }
        }
        return elements;
    }

    /**
     * Get elements by type
     */
    getElementsByType(type) {
        return this.getAllElements().filter(element => element.type === type);
    }

    /**
     * Read file as text
     */
    async readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /**
     * Read file as array buffer
     */
    async readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Load geometry files from CHD folder
     */
    async loadGeometryFromFiles(filesByPath) {
        const geometry = {};
        
        // Find geometry files (chunk_*.bin)
        for (const [path, file] of filesByPath) {
            if (path.includes('geometry/') && path.endsWith('.bin')) {
                const chunkId = path.split('/').pop().replace('.bin', '');
                
                try {
                    const arrayBuffer = await this.readFileAsArrayBuffer(file);
                    const chunk = this.parseGeometryChunk(arrayBuffer, chunkId);
                    geometry[chunkId] = chunk;
                } catch (error) {
                    console.warn(`Failed to load geometry chunk ${chunkId}:`, error);
                }
            }
        }
        
        return geometry;
    }

    /**
     * Load attributes from CHD folder
     */
    async loadAttributesFromFiles(filesByPath) {
        const attributes = {};
        
        // Load materials.cbor
        const materialsFile = this.findFileInPath(filesByPath, 'attributes/materials.cbor');
        if (materialsFile) {
            try {
                const arrayBuffer = await this.readFileAsArrayBuffer(materialsFile);
                attributes.materials = this.parseCBOR(arrayBuffer);
            } catch (error) {
                console.warn('Failed to load materials:', error);
            }
        }
        
        // Load properties.cbor
        const propertiesFile = this.findFileInPath(filesByPath, 'attributes/properties.cbor');
        if (propertiesFile) {
            try {
                const arrayBuffer = await this.readFileAsArrayBuffer(propertiesFile);
                attributes.properties = this.parseCBOR(arrayBuffer);
            } catch (error) {
                console.warn('Failed to load properties:', error);
            }
        }
        
        return attributes;
    }

    /**
     * Load relations from CHD folder
     */
    async loadRelationsFromFiles(filesByPath) {
        const relations = {};
        
        // Load hierarchy.json
        const hierarchyFile = this.findFileInPath(filesByPath, 'relations/hierarchy.json');
        if (hierarchyFile) {
            try {
                const text = await this.readFileAsText(hierarchyFile);
                relations.hierarchy = JSON.parse(text);
            } catch (error) {
                console.warn('Failed to load hierarchy:', error);
            }
        }
        
        // Load references.json
        const referencesFile = this.findFileInPath(filesByPath, 'relations/references.json');
        if (referencesFile) {
            try {
                const text = await this.readFileAsText(referencesFile);
                relations.references = JSON.parse(text);
            } catch (error) {
                console.warn('Failed to load references:', error);
            }
        }
        
        return relations;
    }

    /**
     * Find file in path map
     */
    findFileInPath(filesByPath, targetPath) {
        for (const [path, file] of filesByPath) {
            if (path.endsWith(targetPath) || path === targetPath) {
                return file;
            }
        }
        return null;
    }

    /**
     * Parse geometry chunk from binary data
     */
    parseGeometryChunk(arrayBuffer, chunkId) {
        // Simple binary parser - this would need proper implementation
        // For now, create mock data structure
        console.warn('Binary geometry parsing not fully implemented, using mock data');
        
        return {
            id: chunkId,
            elements: {},
            statistics: { elementCount: 0, vertexCount: 0, faceCount: 0 }
        };
    }

    /**
     * Parse CBOR data (simplified)
     */
    parseCBOR(arrayBuffer) {
        // CBOR parsing would require a library like cbor-js
        // For now, return empty structure
        console.warn('CBOR parsing not implemented, using empty structure');
        return {};
    }
}