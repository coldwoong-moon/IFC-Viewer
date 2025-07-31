import { CHDParser } from './src/parsers/CHDParser.js';

async function debugPositioningData() {
    console.log('🔍 Debugging Positioning Data...\n');
    
    try {
        const parser = new CHDParser({
            loadGeometry: true,
            loadAttributes: true,
            loadSpatialIndex: false
        });
        
        const model = await parser.parse('/Users/coldwoong/Downloads/IFC/test2.chd');
        
        const chunks = Object.entries(model.geometry);
        const [chunkId, chunk] = chunks[0];
        const elements = chunk.getAllElements();
        
        console.log('--- Analyzing Element Attributes for Positioning ---\n');
        
        for (let i = 0; i < Math.min(5, elements.length); i++) {
            const element = elements[i];
            const attrs = model.attributes[element.id];
            
            console.log(`--- Element ${i + 1}: ${element.id} (${element.type}) ---`);
            console.log('Name:', attrs.name);
            console.log('Type:', attrs.type);
            console.log('Level:', attrs.level);
            
            // Check dimensions
            console.log('Dimensions:', attrs.dimensions);
            
            // Check custom properties thoroughly
            console.log('Custom Properties:');
            if (attrs.custom_properties) {
                Object.entries(attrs.custom_properties).forEach(([key, value]) => {
                    console.log(`  ${key}:`, value);
                });
            }
            
            console.log(''); // Empty line between elements
        }
        
        // Look for any transformation or positioning keywords in all attributes
        console.log('--- Searching for positioning keywords across all elements ---');
        const positionKeywords = [
            'transform', 'transformation', 'matrix', 'position', 'location', 
            'placement', 'coordinate', 'origin', 'offset', 'translation',
            'rotation', 'axis', 'direction', 'placement', 'local', 'global'
        ];
        
        let foundKeywords = new Set();
        let exampleFinds = {};
        
        for (const element of elements.slice(0, 20)) { // Check first 20 elements
            const attrs = model.attributes[element.id];
            if (!attrs) continue;
            
            // Check all attribute keys and values
            const allText = JSON.stringify(attrs).toLowerCase();
            
            for (const keyword of positionKeywords) {
                if (allText.includes(keyword)) {
                    foundKeywords.add(keyword);
                    if (!exampleFinds[keyword]) {
                        exampleFinds[keyword] = {
                            elementId: element.id,
                            context: attrs
                        };
                    }
                }
            }
        }
        
        if (foundKeywords.size > 0) {
            console.log('Found positioning keywords:', Array.from(foundKeywords));
            Object.entries(exampleFinds).forEach(([keyword, example]) => {
                console.log(`\nExample of "${keyword}" in element ${example.elementId}:`);
                console.log(JSON.stringify(example.context, null, 2));
            });
        } else {
            console.log('❌ No positioning keywords found in any attributes');
        }
        
        // Check if any elements have different names/tags that might indicate position
        console.log('\n--- Element Variety Check ---');
        const uniqueNames = new Set();
        const uniqueLevels = new Set();
        const uniqueTags = new Set();
        
        elements.slice(0, 50).forEach(element => {
            const attrs = model.attributes[element.id];
            if (attrs) {
                uniqueNames.add(attrs.name);
                uniqueLevels.add(attrs.level);
                if (attrs.custom_properties?.tag) {
                    uniqueTags.add(attrs.custom_properties.tag);
                }
            }
        });
        
        console.log(`Unique names (${uniqueNames.size}):`, Array.from(uniqueNames).slice(0, 10));
        console.log(`Unique levels (${uniqueLevels.size}):`, Array.from(uniqueLevels));
        console.log(`Unique tags (${uniqueTags.size}):`, Array.from(uniqueTags).slice(0, 10));
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugPositioningData();