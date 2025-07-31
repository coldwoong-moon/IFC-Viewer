import fs from 'fs';
import path from 'path';

async function debugCHDFile() {
    console.log('🔍 Debugging CHD File Structure...\n');
    
    const filePath = '/Users/coldwoong/Downloads/IFC/test2.chd';
    
    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.log('❌ CHD file does not exist at:', filePath);
            return;
        }
        
        const stats = fs.statSync(filePath);
        console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
        
        // Check directory structure
        const dir = path.dirname(filePath);
        const basename = path.basename(filePath, '.chd');
        const manifestPath = path.join(dir, basename, 'manifest.json');
        
        console.log('\n📁 Expected CHD structure:');
        console.log('Main file:', filePath);
        console.log('Manifest:', manifestPath);
        
        // Check if it's a directory or single file
        if (fs.existsSync(manifestPath)) {
            console.log('\n✅ Found CHD directory structure');
            
            // Read manifest
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            console.log('Manifest:', JSON.stringify(manifest, null, 2));
            
            // Check for attributes file
            const attributesPath = path.join(dir, basename, 'attributes.cbor');
            if (fs.existsSync(attributesPath)) {
                const attrStats = fs.statSync(attributesPath);
                console.log(`\n📄 Attributes file: ${(attrStats.size / 1024).toFixed(2)} KB`);
            } else {
                console.log('\n❌ No attributes file found at:', attributesPath);
            }
            
            // Check geometry chunks
            const geometryDir = path.join(dir, basename, 'geometry');
            if (fs.existsSync(geometryDir)) {
                const chunks = fs.readdirSync(geometryDir);
                console.log(`\n📦 Geometry chunks: ${chunks.length}`);
                chunks.slice(0, 5).forEach(chunk => {
                    const chunkPath = path.join(geometryDir, chunk);
                    const chunkStats = fs.statSync(chunkPath);
                    console.log(`  ${chunk}: ${(chunkStats.size / 1024).toFixed(2)} KB`);
                });
            }
            
        } else {
            console.log('\n🔍 Checking if it\'s a single file CHD...');
            
            // Try to read as single file (maybe it's compressed/bundled)
            const content = fs.readFileSync(filePath);
            console.log(`First 200 bytes: ${content.slice(0, 200).toString('hex')}`);
            
            // Check if it starts with common file signatures
            const signature = content.slice(0, 4).toString('hex');
            console.log(`File signature: ${signature}`);
            
            if (signature === '504b0304') {
                console.log('Detected ZIP file format');
            } else if (signature === '1f8b0808' || signature.startsWith('1f8b')) {
                console.log('Detected GZIP format');
            } else if (content.slice(0, 1).toString() === '{') {
                console.log('Detected JSON format');
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugCHDFile();