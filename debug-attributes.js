import { CHDParser } from './src/parsers/CHDParser.js';

async function debugAttributes() {
    console.log('🔍 Debugging CHD Attributes and Transformations...\n');
    
    try {
        const parser = new CHDParser({
            loadGeometry: true,
            loadAttributes: true,
            loadSpatialIndex: false
        });
        
        const model = await parser.parse('/Users/coldwoong/Downloads/IFC/test2.chd');
        console.log('Model loaded successfully');
        
        // Check if there are transformation matrices in attributes
        const chunks = Object.entries(model.geometry);
        const [chunkId, chunk] = chunks[0];
        const elements = chunk.getAllElements();
        
        console.log(`\nFound ${elements.length} elements total`);
        
        // Analyze first few elements' attributes
        for (let i = 0; i < Math.min(5, elements.length); i++) {
            const element = elements[i];
            console.log(`\n--- Element ${i + 1}: ${element.id} (${element.type}) ---`);
            
            // Check if element has attributes
            const elementAttributes = model.attributes[element.id];
            if (elementAttributes) {
                console.log('Attributes found:');
                
                // Look for transformation/position data
                if (elementAttributes.transformation) {
                    console.log('  Transformation matrix:', elementAttributes.transformation);
                }
                if (elementAttributes.position) {
                    console.log('  Position:', elementAttributes.position);
                }
                if (elementAttributes.placement) {
                    console.log('  Placement:', elementAttributes.placement);
                }
                if (elementAttributes.location) {
                    console.log('  Location:', elementAttributes.location);
                }
                if (elementAttributes.axis) {
                    console.log('  Axis:', elementAttributes.axis);
                }
                if (elementAttributes.ref_direction) {
                    console.log('  Reference Direction:', elementAttributes.ref_direction);
                }
                
                // Show all properties to see what's available
                console.log('  All properties:', Object.keys(elementAttributes));
                
                // Show some key properties
                ['Name', 'GlobalId', 'ObjectType', 'Tag', 'ObjectPlacement'].forEach(prop => {
                    if (elementAttributes[prop]) {
                        console.log(`  ${prop}:`, elementAttributes[prop]);
                    }
                });
            } else {
                console.log('No attributes found for this element');
            }
        }
        
        // Check chunk spatial information
        console.log('\n--- Chunk Information ---');
        console.log('Chunk ID:', chunkId);
        console.log('Chunk bounds:', chunk.bounds);
        
        // Check if there's spatial indexing data
        if (model.spatialIndex) {
            console.log('\n--- Spatial Index ---');
            console.log('Spatial index entries:', Object.keys(model.spatialIndex).length);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugAttributes();