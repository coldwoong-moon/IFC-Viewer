# CHD 3D Viewer

A web-based 3D viewer for Construction Hybrid Data (CHD) format files.

## 🚀 Features

- **Interactive 3D Visualization**: Navigate and explore CHD models with smooth controls
- **Element Selection**: Click on elements to view detailed properties
- **Material Rendering**: Automatic color coding by element type
- **Performance Optimized**: Efficient rendering for large models
- **File Support**: Load CHD files or demo models
- **Export Capabilities**: Export to JSON, OBJ formats
- **Responsive Design**: Works on desktops, tablets, and mobile devices

## 🏗️ Architecture

The viewer consists of several components:

- **CHDLoader**: Handles loading and parsing CHD files
- **ThreeRenderer**: Three.js-based 3D rendering engine
- **UIController**: Manages user interface interactions
- **ViewerApp**: Main application coordinator
- **Server**: HTTP server for file serving and API endpoints

## 📦 Dependencies

- **Three.js**: 3D graphics library
- **CBOR-X**: Binary data parsing
- **Node.js**: Server runtime (for local development)

## 🚀 Quick Start

### Option 1: Run with Built-in Server

```bash
# Start the viewer server
npm run viewer

# Open in browser
open http://localhost:3000
```

### Option 2: Static File Serving

```bash
# Serve viewer directory with any HTTP server
cd viewer/
python -m http.server 8000

# Open in browser
open http://localhost:8000
```

## 🎮 Controls

### Mouse Controls
- **Left Click**: Select element
- **Left Drag**: Rotate camera
- **Right Drag**: Pan camera
- **Scroll**: Zoom in/out

### Keyboard Shortcuts
- **R**: Reset camera view
- **F**: Fit model to view
- **W**: Toggle wireframe mode
- **F11**: Toggle fullscreen
- **ESC**: Deselect element / Exit fullscreen

### UI Controls
- **Load CHD File**: Browse and load local CHD files
- **Load Test Model**: Load demo building model
- **Reset View**: Reset camera to default position
- **Fit to View**: Fit camera to model bounds
- **Wireframe**: Toggle wireframe rendering
- **Fullscreen**: Enter/exit fullscreen mode

## 📊 Viewer Interface

### Header
- File loading controls
- Model information display

### 3D Viewport
- Interactive 3D scene
- Loading progress overlay
- Viewport controls (floating)
- Performance information

### Sidebar Panels

**Model Information**
- Project details
- Statistics (elements, vertices, faces)
- Bounding box dimensions

**Elements List**
- Filterable by type
- Searchable by name
- Click to select in 3D view

**Properties Panel**
- Selected element details
- Geometry information
- Custom properties
- Dimensions

**Materials Panel**
- Material definitions
- Color swatches
- Physical properties

### Status Bar
- Element/vertex/face counts
- Selected element name
- Memory usage

## 🎨 Element Types & Colors

- **Beams**: Orange (#FF9500)
- **Columns**: Blue (#007AFF)
- **Slabs**: Green (#34C759)
- **Walls**: Red (#FF3B30)
- **Doors**: Purple (#AF52DE)
- **Windows**: Light Blue (#5AC8FA, transparent)

## 📁 File Loading

### Supported Methods

1. **File Upload**: Click "Load CHD File" and select a .chd directory/file
2. **Drag & Drop**: Drag CHD files onto the 3D viewport
3. **Server Loading**: Use "Load Test Model" for demo content
4. **URL Parameters**: `?file=path/to/model.chd`

### CHD File Structure

The viewer expects CHD files in the standard format:
```
model.chd/
├── manifest.json       # Project metadata
├── spatial.idx         # Spatial index (optional)
├── geometry/           # Geometry chunks
│   └── chunk_*.bin
├── attributes/         # Materials and properties
│   ├── materials.cbor
│   └── properties.cbor
└── relations/          # Element relationships
    └── hierarchy.json
```

## 🛠️ Development

### File Structure
```
viewer/
├── index.html          # Main HTML page
├── css/
│   └── viewer.css      # Styles
├── js/
│   ├── chd-loader.js   # CHD file loading 
│   ├── three-renderer.js # 3D rendering
│   ├── ui-controller.js # UI management
│   └── viewer-app.js   # Main application
├── server.js           # Development server
└── README.md           # This file
```

### Local Development
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run viewer

# The server will:
# - Serve viewer files at http://localhost:3000
# - Provide API endpoints for CHD loading
# - Auto-reload on file changes
```

### API Endpoints

**POST /api/load-chd**
```json
{
  "fileName": "test2.chd",
  "loadGeometry": true,
  "loadAttributes": true
}
```

**GET /api/status**
Returns server status and information.

## 🔧 Configuration

### Renderer Options
- **Antialiasing**: Smooth edge rendering
- **Shadows**: Realistic lighting effects
- **Performance**: Automatic optimization for device capabilities

### Viewer Options
- **Auto-load**: Automatically load test model in development
- **Progress**: Loading progress callbacks
- **Error Handling**: Graceful error recovery

## 🎯 Performance Tips

### For Large Models
- Use spatial indexing for faster queries
- Enable geometry chunking
- Consider level-of-detail (LOD) for distant objects
- Use wireframe mode for overview

### Browser Compatibility
- **Chrome/Edge**: Full feature support
- **Firefox**: Full feature support
- **Safari**: Full feature support (may need WebGL2 fallback)
- **Mobile**: Optimized for touch devices

## 📱 Mobile Support

The viewer is responsive and supports mobile devices:
- Touch controls for navigation
- Adaptive UI layout
- Performance optimizations
- Gesture support (pinch to zoom, etc.)

## 🐛 Troubleshooting

### Common Issues

**"No model loaded"**
- Check CHD file format and structure
- Verify file permissions
- Try the demo model first

**"Failed to load file"**
- Ensure file is a valid CHD format
- Check browser console for detailed errors
- Try a smaller test file

**Poor Performance**
- Reduce model complexity
- Enable wireframe mode
- Close other browser tabs
- Check system resources

**Rendering Issues**
- Update graphics drivers
- Try different browsers
- Disable browser extensions
- Check WebGL support

### Debug Mode

Add `?dev=true` to the URL for debug features:
- Detailed error messages
- Performance monitoring
- Console logging
- Auto-load test model

## 📄 License

MIT License - see main project LICENSE file.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with various CHD files
5. Submit a pull request

---

**CHD 3D Viewer** - Part of the CHD Format Project  
Built with ❤️ and Three.js