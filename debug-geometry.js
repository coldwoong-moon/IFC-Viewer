import { CHDParser } from './src/parsers/CHDParser.js';

async function debugGeometry() {
    console.log('🔍 Debugging CHD Geometry...\n');
    
    try {
        const parser = new CHDParser({
            loadGeometry: true,
            loadAttributes: true,
            loadSpatialIndex: false
        });
        
        const model = await parser.parse('/Users/coldwoong/Downloads/IFC/test2.chd');
        console.log('Model loaded successfully');
        
        // Get first chunk and first element
        const chunks = Object.entries(model.geometry);
        if (chunks.length === 0) {
            console.log('No geometry chunks found');
            return;
        }
        
        const [chunkId, chunk] = chunks[0];
        console.log(`\nAnalyzing chunk: ${chunkId}`);
        
        const elements = chunk.getAllElements();
        if (elements.length === 0) {
            console.log('No elements in chunk');
            return;
        }
        
        // Analyze first few elements
        for (let i = 0; i < Math.min(3, elements.length); i++) {
            const element = elements[i];
            console.log(`\n--- Element ${i + 1}: ${element.id} (${element.type}) ---`);
            console.log('Vertices:', element.vertices.length);
            console.log('Faces:', element.faces.length);
            
            // Show first few vertices
            console.log('First 4 vertices:');
            for (let j = 0; j < Math.min(4, element.vertices.length); j++) {
                const v = element.vertices[j];
                console.log(`  [${j}]: (${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)})`);
            }
            
            // Show first few faces
            console.log('First 4 faces:');
            for (let j = 0; j < Math.min(4, element.faces.length); j++) {
                const f = element.faces[j];
                console.log(`  [${j}]: [${f[0]}, ${f[1]}, ${f[2]}]`);
            }
            
            // Calculate actual bounding box
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            
            for (const vertex of element.vertices) {
                minX = Math.min(minX, vertex[0]);
                minY = Math.min(minY, vertex[1]);
                minZ = Math.min(minZ, vertex[2]);
                maxX = Math.max(maxX, vertex[0]);
                maxY = Math.max(maxY, vertex[1]);
                maxZ = Math.max(maxZ, vertex[2]);
            }
            
            console.log('Calculated bounding box:');
            console.log(`  Min: (${minX.toFixed(2)}, ${minY.toFixed(2)}, ${minZ.toFixed(2)})`);
            console.log(`  Max: (${maxX.toFixed(2)}, ${maxY.toFixed(2)}, ${maxZ.toFixed(2)})`);
            console.log(`  Size: ${(maxX-minX).toFixed(2)} × ${(maxY-minY).toFixed(2)} × ${(maxZ-minZ).toFixed(2)} mm`);
            console.log(`  Size: ${((maxX-minX)/1000).toFixed(3)} × ${((maxY-minY)/1000).toFixed(3)} × ${((maxZ-minZ)/1000).toFixed(3)} m`);
            
            // Check for degenerate geometry
            if (maxX === minX || maxY === minY || maxZ === minZ) {
                console.log('⚠️  WARNING: Degenerate geometry detected (zero dimension)');
            }
        }
        
        // Check project units and coordinate system
        console.log('\n--- Project Info ---');
        console.log('Units:', model.project.units);
        console.log('Coordinate System:', model.project.coordinate_system);
        console.log('Project Bounding Box:', model.project.bounding_box);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugGeometry();