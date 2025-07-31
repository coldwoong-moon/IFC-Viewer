import { CHDParser } from './src/parsers/CHDParser.js';
import fs from 'fs';

async function analyzePositions() {
    console.log('🔍 Analyzing CHD position data...\n');
    
    try {
        const parser = new CHDParser({
            loadGeometry: true,
            loadAttributes: true,
            loadSpatialIndex: false
        });
        
        const model = await parser.parse('/Users/coldwoong/Downloads/IFC/test2.chd');
        
        console.log('📊 Model Statistics:', {
            totalElements: model.statistics.total_elements,
            totalVertices: model.statistics.total_vertices,
            boundingBox: model.project.bounding_box,
            coordinateSystem: model.project.coordinate_system,
            units: model.project.units
        });
        
        console.log('\n🏗️ Model Structure:', Object.keys(model));
        
        // Check different possible data structures
        let elementsData = model.elements || model.geometry || model.chunks || {};
        console.log('Elements data keys:', Object.keys(elementsData));
        
        console.log('\n🏗️ Sample Element Analysis:');
        
        let sampleCount = 0;
        const maxSamples = 10;
        
        for (const [elementId, elementData] of Object.entries(elementsData)) {
            if (sampleCount >= maxSamples) break;
            
            if (elementData.vertices && elementData.vertices.length > 0) {
                const vertices = elementData.vertices;
                const minX = Math.min(...vertices.map(v => v[0]));
                const maxX = Math.max(...vertices.map(v => v[0]));
                const minY = Math.min(...vertices.map(v => v[1]));
                const maxY = Math.max(...vertices.map(v => v[1]));
                const minZ = Math.min(...vertices.map(v => v[2]));
                const maxZ = Math.max(...vertices.map(v => v[2]));
                
                console.log(`\n  Element ${elementId}:`);
                console.log(`    Type: ${elementData.type || 'Unknown'}`);
                console.log(`    Vertices: ${vertices.length}`);
                console.log(`    X range: ${minX.toFixed(2)} to ${maxX.toFixed(2)} (${(maxX-minX).toFixed(2)})`);
                console.log(`    Y range: ${minY.toFixed(2)} to ${maxY.toFixed(2)} (${(maxY-minY).toFixed(2)})`);
                console.log(`    Z range: ${minZ.toFixed(2)} to ${maxZ.toFixed(2)} (${(maxZ-minZ).toFixed(2)})`);
                console.log(`    Center: [${((minX+maxX)/2).toFixed(2)}, ${((minY+maxY)/2).toFixed(2)}, ${((minZ+maxZ)/2).toFixed(2)}]`);
                
                sampleCount++;
            }
        }
        
        // Analyze overall coordinate distribution
        console.log('\n📈 Overall Coordinate Analysis:');
        let allX = [], allY = [], allZ = [];
        
        for (const elementData of Object.values(elementsData)) {
            if (elementData.vertices) {
                for (const vertex of elementData.vertices) {
                    allX.push(vertex[0]);
                    allY.push(vertex[1]);
                    allZ.push(vertex[2]);
                }
            }
        }
        
        if (allX.length > 0) {
            console.log(`  Total vertices analyzed: ${allX.length}`);
            console.log(`  X: ${Math.min(...allX).toFixed(2)} to ${Math.max(...allX).toFixed(2)}`);
            console.log(`  Y: ${Math.min(...allY).toFixed(2)} to ${Math.max(...allY).toFixed(2)}`);
            console.log(`  Z: ${Math.min(...allZ).toFixed(2)} to ${Math.max(...allZ).toFixed(2)}`);
            
            // Check if coordinates are clustered (indicating missing transformations)
            const xRange = Math.max(...allX) - Math.min(...allX);
            const yRange = Math.max(...allY) - Math.min(...allY);
            const zRange = Math.max(...allZ) - Math.min(...allZ);
            
            console.log(`\n⚠️  Coordinate Range Analysis:`);
            console.log(`  X span: ${xRange.toFixed(2)} ${model.project.units}`);
            console.log(`  Y span: ${yRange.toFixed(2)} ${model.project.units}`);
            console.log(`  Z span: ${zRange.toFixed(2)} ${model.project.units}`);
            
            if (xRange < 1000 && yRange < 1000 && zRange < 1000) {
                console.log(`\n🚨 ISSUE DETECTED: All coordinates are within a very small range!`);
                console.log(`   This suggests that IFC placement transformations were not applied`);
                console.log(`   during conversion. Elements are likely positioned at their local`);
                console.log(`   geometry coordinates rather than world coordinates.`);
            }
        }
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        console.error(error);
    }
}

analyzePositions();