import { CHDParser } from './src/parsers/CHDParser.js';

async function debugIdMapping() {
    console.log('🔍 Debugging ID Mapping...\n');
    
    try {
        const parser = new CHDParser({
            loadGeometry: true,
            loadAttributes: true,
            loadSpatialIndex: false
        });
        
        const model = await parser.parse('/Users/coldwoong/Downloads/IFC/test2.chd');
        
        // Get geometry element IDs
        const chunks = Object.entries(model.geometry);
        const [chunkId, chunk] = chunks[0];
        const elements = chunk.getAllElements();
        
        console.log('--- Geometry Element IDs (first 10) ---');
        elements.slice(0, 10).forEach((elem, i) => {
            console.log(`${i + 1}. ID: ${elem.id}, Type: ${elem.type}`);
        });
        
        // Get attribute keys
        const attributeKeys = Object.keys(model.attributes);
        console.log('\n--- Attribute Keys (first 10) ---');
        attributeKeys.slice(0, 10).forEach((key, i) => {
            console.log(`${i + 1}. Key: ${key}`);
        });
        
        // Check if attributes contain numeric IDs
        console.log('\n--- Checking for numeric ID mapping ---');
        const firstAttrKey = attributeKeys[0];
        const firstAttr = model.attributes[firstAttrKey];
        
        console.log(`First attribute (${firstAttrKey}):`, firstAttr);
        
        // Look for custom_properties that might contain the numeric ID
        if (firstAttr.custom_properties) {
            console.log('Custom properties:', firstAttr.custom_properties);
            
            // Check if ifc_id matches any geometry ID
            const ifcId = firstAttr.custom_properties.ifc_id;
            if (ifcId) {
                console.log(`IFC ID: ${ifcId}`);
                
                // Check if this ID exists in geometry
                const matchingElement = elements.find(elem => elem.id == ifcId);
                if (matchingElement) {
                    console.log(`✅ Found matching element! Geometry ID ${matchingElement.id} matches IFC ID ${ifcId}`);
                } else {
                    console.log(`❌ No matching element found for IFC ID ${ifcId}`);
                }
            }
        }
        
        // Try to find any matching pattern
        console.log('\n--- Looking for ID patterns ---');
        for (let i = 0; i < Math.min(5, attributeKeys.length); i++) {
            const attrKey = attributeKeys[i];
            const attr = model.attributes[attrKey];
            const ifcId = attr.custom_properties?.ifc_id;
            
            if (ifcId) {
                const matchingElement = elements.find(elem => elem.id == ifcId);
                if (matchingElement) {
                    console.log(`Match found: ${attrKey} (IFC:${ifcId}) -> Geometry:${matchingElement.id}`);
                } else {
                    console.log(`No match: ${attrKey} (IFC:${ifcId}) -> No geometry element`);
                }
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugIdMapping();