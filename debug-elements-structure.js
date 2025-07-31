import { CHDParser } from './src/parsers/CHDParser.js';

async function debugElementsStructure() {
    console.log('🔍 Debugging Elements Structure...\n');
    
    try {
        const parser = new CHDParser({
            loadGeometry: true,
            loadAttributes: true,
            loadSpatialIndex: false
        });
        
        const model = await parser.parse('/Users/coldwoong/Downloads/IFC/test2.chd');
        
        const elements = model.attributes.properties.elements;
        console.log('Elements type:', typeof elements);
        console.log('Elements keys:', Object.keys(elements).slice(0, 10));
        
        // Check first element
        const firstKey = Object.keys(elements)[0];
        const firstElement = elements[firstKey];
        
        console.log(`\n--- First Element: ${firstKey} ---`);
        console.log('Type:', typeof firstElement);
        
        if (typeof firstElement === 'object') {
            console.log('Properties:', Object.keys(firstElement));
            
            // Look for transformation/position data
            ['transformation', 'position', 'placement', 'location', 'ObjectPlacement', 'LocalPlacement'].forEach(key => {
                if (firstElement[key]) {
                    console.log(`${key}:`, firstElement[key]);
                }
            });
            
            // Show all properties
            console.log('\nAll properties:');
            Object.entries(firstElement).forEach(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    console.log(`  ${key}:`, JSON.stringify(value).substring(0, 200));
                } else {
                    console.log(`  ${key}:`, value);
                }
            });
        }
        
        // Check if any element has positioning data
        console.log('\n--- Searching for positioning data ---');
        let foundPositioning = false;
        let count = 0;
        
        for (const [elemId, elemData] of Object.entries(elements)) {
            if (count > 10) break; // Check first 10 elements
            count++;
            
            const positionKeys = ['transformation', 'position', 'placement', 'location', 'ObjectPlacement', 'LocalPlacement'];
            const hasPositioning = positionKeys.some(key => elemData[key]);
            
            if (hasPositioning) {
                console.log(`Element ${elemId} has positioning data:`);
                positionKeys.forEach(key => {
                    if (elemData[key]) {
                        console.log(`  ${key}:`, elemData[key]);
                    }
                });
                foundPositioning = true;
                break;
            }
        }
        
        if (!foundPositioning) {
            console.log('No positioning data found in first 10 elements');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugElementsStructure();