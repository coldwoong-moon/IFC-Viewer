import { CHDParser } from './src/parsers/CHDParser.js';

async function analyzeGeometry() {
  const parser = new CHDParser({ loadGeometry: true, loadAttributes: false });
  
  try {
    console.log('🔄 Loading CHD file...');
    const model = await parser.parse('/Users/coldwoong/Downloads/IFC/test2_debug4.chd');
    
    console.log('\n=== CHD Model Analysis ===');
    console.log('Total elements:', model.statistics.total_elements);
    console.log('Total vertices:', model.statistics.total_vertices);  
    console.log('Total faces:', model.statistics.total_faces);
    console.log('Average vertices per element:', (model.statistics.total_vertices / model.statistics.total_elements).toFixed(2));
    console.log('Average faces per element:', (model.statistics.total_faces / model.statistics.total_elements).toFixed(2));
    
    console.log('\n=== Geometry Chunks ===');
    const chunks = Object.values(model.geometry);
    console.log('Number of chunks:', chunks.length);
    
    if (chunks.length > 0) {
      const firstChunk = chunks[0];
      const elements = firstChunk.elements || {};
      console.log('Elements in first chunk:', Object.keys(elements).length);
      
      console.log('\n=== Element Analysis ===');
      let simpleBoxCount = 0;
      let complexGeometryCount = 0;
      let analyzedCount = 0;
      
      for (const [id, element] of Object.entries(elements)) {
        if (analyzedCount >= 10) break; // Analyze first 10 elements
        
        const vertexCount = element.vertices ? element.vertices.length : 0;
        const faceCount = element.faces ? element.faces.length : 0;
        
        console.log(`Element ${id}:`);
        console.log(`  Type: ${element.type || 'unknown'}`);
        console.log(`  Vertices: ${vertexCount}`);
        console.log(`  Faces: ${faceCount}`);
        
        // Check if it's a simple box (8 vertices, 12 faces)
        if (vertexCount === 8 && faceCount === 12) {
          simpleBoxCount++;
          console.log('  → Simple box geometry detected');
        } else if (vertexCount > 8) {
          complexGeometryCount++;
          console.log('  → Complex geometry detected');
        }
        
        analyzedCount++;
      }
      
      console.log(`\n=== Summary ===`);
      console.log(`Analyzed ${analyzedCount} elements:`);
      console.log(`  Simple boxes: ${simpleBoxCount}`);
      console.log(`  Complex geometry: ${complexGeometryCount}`);
      console.log(`  Other: ${analyzedCount - simpleBoxCount - complexGeometryCount}`);
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

analyzeGeometry();