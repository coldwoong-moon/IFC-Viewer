import { IFCToCHDConverter } from './src/converters/IFCToCHDConverter.js';
import path from 'path';
import fs from 'fs';

async function convertTest2() {
    console.log('🏗️ Converting test2.ifc with proper placement handling...\n');
    
    try {
        // Create converter
        const converter = new IFCToCHDConverter({
            preserveTransformations: true,
            parseGeometry: true,
            parseAttributes: true,
            parseHierarchy: true,
            coordinateUnits: 'millimeters'
        });
        
        // Convert IFC to CHD
        const result = await converter.convert(
            '/Users/coldwoong/Downloads/IFC/test2.ifc',
            '/Users/coldwoong/Downloads/IFC/test2_fixed.chd'
        );
        
        console.log('\n📊 Conversion Results:');
        console.log('   Success:', result.success);
        console.log('   Elements:', result.elementsProcessed);
        console.log('   Output:', result.outputPath);
        console.log('   Bounding Box:', {
            min: result.boundingBox.min.map(v => `${(v/1000).toFixed(1)}m`),
            max: result.boundingBox.max.map(v => `${(v/1000).toFixed(1)}m`)
        });
        
        // Compare with original
        if (fs.existsSync('/Users/coldwoong/Downloads/IFC/test2.chd')) {
            console.log('\n🔍 Comparison with original CHD:');
            console.log('   Original bounding box: -0.25m to 0.25m (500mm range)');
            
            const newRange = result.boundingBox.max.map((max, i) => 
                (max - result.boundingBox.min[i]) / 1000
            );
            console.log(`   New bounding box range: ${newRange.map(r => r.toFixed(1))}m`);
            
            if (newRange.some(r => r > 10)) {
                console.log('   ✅ SUCCESS: Bounding box is now realistic building size!');
            } else {
                console.log('   ⚠️  WARNING: Bounding box still seems small');
            }
        }
        
    } catch (error) {
        console.error('❌ Conversion failed:', error.message);
        console.error(error.stack);
    }
}

convertTest2();