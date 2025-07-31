import { CHDParser } from './src/parsers/CHDParser.js';

async function checkElementTypes() {
    try {
        const parser = new CHDParser();
        const data = await parser.parse('/Users/coldwoong/Downloads/IFC/test2.chd');
        
        console.log('📊 Element Analysis:');
        console.log('Data structure:', Object.keys(data));
        console.log('Geometry chunks:', Object.keys(data.geometry));
        console.log('Attributes count:', Object.keys(data.attributes).length);
        
        const typeCount = {};
        const sampleElements = {};
        
        // Analyze attributes to get element types
        for (const [id, attributes] of Object.entries(data.attributes)) {
            const type = attributes.IfcType || attributes.type || 'unknown';
            
            if (!typeCount[type]) {
                typeCount[type] = 0;
                sampleElements[type] = [];
            }
            
            typeCount[type]++;
            
            if (sampleElements[type].length < 3) {
                // Check if this element has geometry in any chunk
                let hasGeometry = false;
                for (const [chunkId, chunk] of Object.entries(data.geometry)) {
                    if (chunk.getAllElements) {
                        const elements = chunk.getAllElements();
                        if (elements.find(el => el.id == id)) {
                            hasGeometry = true;
                            break;
                        }
                    }
                }
                
                sampleElements[type].push({
                    id,
                    attributes,
                    hasGeometry,
                    rawType: attributes.type,
                    ifcType: attributes.IfcType
                });
            }
        }
        
        for (const [type, count] of Object.entries(typeCount)) {
            console.log(`\n--- ${type} (${count} elements) ---`);
            
            for (const sample of sampleElements[type]) {
                console.log(`Element ${sample.id}:`);
                console.log(`  Has Geometry: ${sample.hasGeometry}`);
                console.log(`  Raw Type: ${sample.rawType}`);
                console.log(`  IFC Type: ${sample.ifcType}`);
                
                if (sample.attributes) {
                    const attrs = Object.keys(sample.attributes);
                    console.log(`  Attributes: ${attrs.length} (${attrs.slice(0,8).join(', ')}${attrs.length > 8 ? '...' : ''})`);
                    
                    // Look for dimension/size related attributes
                    const sizeAttrs = ['Length', 'Width', 'Height', 'Thickness', 'Depth', 'dimensions', 'size'];
                    for (const attr of sizeAttrs) {
                        if (sample.attributes[attr]) {
                            console.log(`  ${attr}: ${JSON.stringify(sample.attributes[attr])}`);
                        }
                    }
                    
                    if (sample.attributes.materials) {
                        console.log(`  Materials: ${JSON.stringify(sample.attributes.materials)}`);
                    }
                }
                console.log('');
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
        console.error(error.stack);
    }
}

checkElementTypes();