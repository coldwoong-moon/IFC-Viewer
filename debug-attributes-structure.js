import { CHDParser } from './src/parsers/CHDParser.js';

async function debugAttributeStructure() {
    console.log('🔍 Debugging CHD Attribute Structure...\n');
    
    try {
        const parser = new CHDParser({
            loadGeometry: true,
            loadAttributes: true,
            loadSpatialIndex: false
        });
        
        const model = await parser.parse('/Users/coldwoong/Downloads/IFC/test2.chd');
        console.log('Model loaded successfully');
        
        console.log('\n--- Attributes Structure ---');
        console.log('model.attributes keys:', Object.keys(model.attributes));
        
        // Check if attributes are nested under 'properties'
        if (model.attributes.properties) {
            console.log('Found properties nested under attributes.properties');
            console.log('Properties keys:', Object.keys(model.attributes.properties).slice(0, 10));
            
            // Try to find an element's attributes
            const chunks = Object.entries(model.geometry);
            const [chunkId, chunk] = chunks[0];
            const elements = chunk.getAllElements();
            const firstElement = elements[0];
            
            console.log(`\n--- Looking for element ${firstElement.id} attributes ---`);
            
            // Check if element ID exists in properties
            const elementAttrs = model.attributes.properties[firstElement.id];
            if (elementAttrs) {
                console.log('✅ Found attributes for element:', firstElement.id);
                console.log('Attribute keys:', Object.keys(elementAttrs));
                
                // Look for transformation/position data
                ['transformation', 'position', 'placement', 'location', 'ObjectPlacement', 'LocalPlacement'].forEach(key => {
                    if (elementAttrs[key]) {
                        console.log(`${key}:`, elementAttrs[key]);
                    }
                });
                
                // Show all properties to find positioning data
                console.log('\nAll properties:');
                Object.entries(elementAttrs).forEach(([key, value]) => {
                    if (typeof value === 'object' && value !== null) {
                        console.log(`  ${key}:`, JSON.stringify(value).substring(0, 200));
                    } else {
                        console.log(`  ${key}:`, value);
                    }
                });
                
            } else {
                console.log('❌ No attributes found for element:', firstElement.id);
                console.log('Available element IDs (first 10):', Object.keys(model.attributes.properties).slice(0, 10));
            }
        } else {
            console.log('No properties found in attributes');
            console.log('Attributes structure:', model.attributes);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugAttributeStructure();