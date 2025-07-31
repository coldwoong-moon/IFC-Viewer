/**
 * Three.js 3D Renderer for CHD Models
 */

export class ThreeRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.elements = new Map();
        this.selectedElement = null;
        this.wireframeMode = false;
        this.stats = { fps: 0, frameCount: 0, lastTime: 0 };
        
        this.onElementSelect = null;
        this.onElementHover = null;
        
        this.init();
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        // Create camera with extended viewing distance for very large models
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 500000); // Much larger far plane for huge models
        this.camera.position.set(1000, 800, 1000); // Adjusted for potential millimeter scale

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Create controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Setup lighting
        this.setupLighting();
        
        // Setup mouse interaction
        this.setupMouseInteraction();
        
        // Start render loop
        this.startRenderLoop();
        
        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(2000, 1500, 2000); // Adjusted for larger scale
        this.scene.add(directionalLight);
    }

    startRenderLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            this.controls.update();
            this.updateStats();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    updateStats() {
        this.stats.frameCount++;
        const now = performance.now();
        
        if (now - this.stats.lastTime >= 1000) {
            this.stats.fps = Math.round((this.stats.frameCount * 1000) / (now - this.stats.lastTime));
            this.stats.frameCount = 0;
            this.stats.lastTime = now;
        }
    }

    loadModel(model) {
        this.clearScene();

        if (!model || !model.geometry) {
            console.warn('No geometry data in model');
            return;
        }

        let totalElements = 0;
        for (const [chunkId, chunk] of Object.entries(model.geometry)) {
            if (chunk.elements) {
                for (const [elementId, element] of Object.entries(chunk.elements)) {
                    this.createElement(elementId, element);
                    totalElements++;
                }
            }
        }

        console.log(`🎯 Loaded ${totalElements} elements into scene`);
        if (totalElements === 0) {
            console.warn('⚠️ No elements were created - check geometry data');
        }
        this.fitCameraToScene();
    }

    createElement(elementId, elementData) {
        console.log(`🔧 Creating element ${elementId}: ${elementData.vertices?.length || 0} vertices, ${elementData.faces?.length || 0} faces`);
        
        // Use actual geometry from CHD file (now with proper transformations)
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        
        // Extract vertices from CHD data
        if (elementData.vertices && elementData.vertices.length > 0) {
            for (const vertex of elementData.vertices) {
                vertices.push(vertex[0], vertex[1], vertex[2]);
            }
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            
            // Add faces if available
            if (elementData.faces && elementData.faces.length > 0) {
                const indices = [];
                for (const face of elementData.faces) {
                    indices.push(face[0], face[1], face[2]);
                }
                geometry.setIndex(indices);
            }
            
            geometry.computeVertexNormals();
        } else {
            console.warn(`No vertex data for element ${elementId}, using default geometry`);
            // Fallback to default geometry
            geometry.copy(this.createProperGeometry(elementData.type, elementId));
        }
        
        const material = this.createDefaultMaterial(elementData.type);
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.userData = {
            elementId: elementId,
            elementType: elementData.type,
            originalMaterial: material
        };

        // Apply positioning based on element type if vertices don't contain position info
        if (elementData.vertices && elementData.vertices.length > 0) {
            // Vertices already contain position info, use as-is
            console.log(`Element ${elementId} uses vertex positions directly`);
        } else {
            // Apply building positioning for elements without vertex data
            this.applyBuildingPositioning(mesh, elementData.type, elementId);
        }

        this.scene.add(mesh);
        this.elements.set(elementId, mesh);
        
        console.log(`Created element ${elementId} with ${vertices.length/3} vertices`);
    }

    applySyntheticPositioning(mesh, elementId) {
        // Create a grid layout to spread elements out for visualization
        // Since all elements are identical 500x500x500mm boxes, we'll arrange them in a grid
        
        if (!this.elementIndex) this.elementIndex = 0;
        
        const spacing = 1.0; // 1 meter spacing between elements
        const gridSize = Math.ceil(Math.sqrt(490)); // Approximate grid size for 490 elements
        
        const row = Math.floor(this.elementIndex / gridSize);
        const col = this.elementIndex % gridSize;
        
        // Position elements in a grid pattern
        mesh.position.set(
            col * spacing - (gridSize * spacing) / 2,  // Center the grid
            0,                                         // Keep at ground level
            row * spacing - (gridSize * spacing) / 2   // Center the grid
        );
        
        // Add slight random variation to make it more interesting
        mesh.position.x += (Math.random() - 0.5) * 0.2;
        mesh.position.z += (Math.random() - 0.5) * 0.2;
        mesh.position.y += Math.random() * 0.1; // Slight height variation
        
        this.elementIndex++;
        
        console.log(`Positioned element ${elementId} at (${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
    }

    createProperGeometry(elementType, elementId) {
        let geometry;
        
        // Use meter scale for better visualization
        switch (elementType) {
            case 'column':
                // Columns: tall vertical elements
                geometry = new THREE.BoxGeometry(0.3, 3.0, 0.3); // 30cm x 3m x 30cm
                break;
                
            case 'beam':
                // Beams: horizontal structural elements
                geometry = new THREE.BoxGeometry(4.0, 0.4, 0.3); // 4m x 40cm x 30cm
                break;
                
            case 'slab':
                // Slabs: thin horizontal floor/ceiling elements
                geometry = new THREE.BoxGeometry(4.0, 0.2, 4.0); // 4m x 20cm x 4m
                break;
                
            default:
                // Default cube for unknown types
                geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
                break;
        }
        
        return geometry;
    }

    applyBuildingPositioning(mesh, elementType, elementId) {
        // Initialize counters if not exists
        if (!this.elementCounters) {
            this.elementCounters = { column: 0, beam: 0, slab: 0, default: 0 };
        }
        
        const counter = this.elementCounters[elementType] || 0;
        this.elementCounters[elementType] = counter + 1;
        
        switch (elementType) {
            case 'column':
                // Arrange columns in a building grid (meter scale)
                const colSpacing = 6; // 6m spacing between columns
                const colGridSize = Math.ceil(Math.sqrt(9)); // 9 columns for demo
                const colRow = Math.floor(counter / colGridSize);
                const colCol = counter % colGridSize;
                
                mesh.position.set(
                    colCol * colSpacing - (colGridSize * colSpacing) / 2,
                    1.5, // Half height above ground (3m total height)
                    colRow * colSpacing - (colGridSize * colSpacing) / 2
                );
                break;
                
            case 'beam':
                // Arrange beams connecting columns at different levels
                const beamSpacing = 4; // 4m spacing
                const beamGridSize = Math.ceil(Math.sqrt(20)); // 20 beams for demo
                const beamRow = Math.floor(counter / beamGridSize);
                const beamCol = counter % beamGridSize;
                
                mesh.position.set(
                    beamCol * beamSpacing - (beamGridSize * beamSpacing) / 2,
                    3.2 + (counter % 3) * 3, // Multiple floor levels
                    beamRow * beamSpacing - (beamGridSize * beamSpacing) / 2
                );
                break;
                
            case 'slab':
                // Arrange slabs as floor plates
                const slabSpacing = 8; // 8m spacing
                const slabGridSize = Math.ceil(Math.sqrt(4)); // 4 slabs for demo
                const slabRow = Math.floor(counter / slabGridSize);
                const slabCol = counter % slabGridSize;
                
                mesh.position.set(
                    slabCol * slabSpacing - (slabGridSize * slabSpacing) / 2,
                    3 + (counter % 3) * 3, // Multiple floor levels
                    slabRow * slabSpacing - (slabGridSize * slabSpacing) / 2
                );
                break;
                
            default:
                // Default grid positioning
                const defaultSpacing = 2;
                const defaultGridSize = Math.ceil(Math.sqrt(10));
                const defaultRow = Math.floor(counter / defaultGridSize);
                const defaultCol = counter % defaultGridSize;
                
                mesh.position.set(
                    defaultCol * defaultSpacing,
                    0,
                    defaultRow * defaultSpacing
                );
                break;
        }
    }

    createDefaultMaterial(elementType) {
        const colors = {
            beam: 0xFF9500,
            column: 0x007AFF,
            slab: 0x34C759,
            wall: 0xFF3B30,
            generic: 0x8E8E93
        };

        const color = colors[elementType] || colors.generic;
        return new THREE.MeshLambertMaterial({ color: color });
    }

    fitCameraToScene() {
        const box = new THREE.Box3();
        this.scene.traverse((object) => {
            if (object.isMesh) {
                box.expandByObject(object);
            }
        });

        if (box.isEmpty()) return;

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = Math.min(maxDim * 2.5, this.camera.far * 0.8); // Ensure distance is within far plane

        console.log(`Scene bounds: size=${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)}, center=(${center.x.toFixed(1)},${center.y.toFixed(1)},${center.z.toFixed(1)}), distance=${distance.toFixed(1)}`);

        // Position camera at a safe distance
        this.camera.position.copy(center);
        this.camera.position.x += distance * 0.7;
        this.camera.position.y += distance * 0.7;
        this.camera.position.z += distance * 0.7;
        this.camera.lookAt(center);

        // Update near and far planes based on scene size
        this.camera.near = Math.max(0.1, maxDim * 0.001);
        this.camera.far = Math.max(500000, distance * 10);
        this.camera.updateProjectionMatrix();

        this.controls.target.copy(center);
        this.controls.update();

        console.log(`📷 Camera positioned at (${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)}, ${this.camera.position.z.toFixed(1)}), looking at (${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)})`);
    }

    toggleWireframe() {
        this.wireframeMode = !this.wireframeMode;
        for (const mesh of this.elements.values()) {
            mesh.material.wireframe = this.wireframeMode;
        }
        return this.wireframeMode;
    }

    clearScene() {
        const meshes = [];
        this.scene.traverse((object) => {
            if (object.isMesh && object.userData.elementId) {
                meshes.push(object);
            }
        });

        for (const mesh of meshes) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        }

        this.elements.clear();
    }

    onWindowResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    setupMouseInteraction() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.canvas.addEventListener('click', (event) => {
            event.preventDefault();
            
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            this.raycaster.setFromCamera(this.mouse, this.camera);
            
            const meshes = Array.from(this.elements.values());
            const intersects = this.raycaster.intersectObjects(meshes);
            
            if (intersects.length > 0) {
                const elementId = intersects[0].object.userData.elementId;
                this.selectElement(elementId);
                
                if (this.onElementSelect) {
                    this.onElementSelect(elementId);
                }
            }
        });
    }

    selectElement(elementId) {
        // Clear previous selection
        if (this.selectedElement) {
            this.selectedElement.material = this.selectedElement.userData.originalMaterial;
        }
        
        // Set new selection
        const mesh = this.elements.get(elementId);
        if (mesh) {
            this.selectedElement = mesh;
            
            // Create selection material
            const selectionMaterial = new THREE.MeshLambertMaterial({
                color: 0xFFFF00,
                transparent: true,
                opacity: 0.8
            });
            
            mesh.material = selectionMaterial;
        }
    }

    resetCamera() {
        this.camera.position.set(1000, 800, 1000);
        this.camera.lookAt(0, 0, 0);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    getStats() {
        return {
            fps: this.stats.fps,
            geometries: this.elements.size,
            triangles: this.renderer.info.render.triangles
        };
    }
}