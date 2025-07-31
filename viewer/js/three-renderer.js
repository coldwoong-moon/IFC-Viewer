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

        // Create enhanced user-friendly controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        // 부드러운 움직임을 위한 댐핑 설정
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08; // 더 부드러운 움직임
        
        // 마우스 감도 조정 (건축 모델 뷰잉에 최적화)
        this.controls.rotateSpeed = 0.8;     // 회전 속도 (기본값보다 약간 느리게)
        this.controls.zoomSpeed = 1.2;       // 줌 속도 (더 반응성 있게)
        this.controls.panSpeed = 1.0;        // 팬 속도
        
        // 줌 제한 설정 (건축 모델에 적합)
        this.controls.minDistance = 10;      // 최소 줌인 거리
        this.controls.maxDistance = 50000;   // 최대 줌아웃 거리
        
        // 수직 회전 제한 (바닥 아래로 가지 않도록)
        this.controls.maxPolarAngle = Math.PI * 0.9; // 약 162도까지만 회전
        this.controls.minPolarAngle = Math.PI * 0.1; // 약 18도부터 시작
        
        // 키보드 지원 활성화
        this.controls.enableKeys = true;
        this.controls.keys = {
            LEFT: 'ArrowLeft',   // 왼쪽 화살표
            UP: 'ArrowUp',       // 위쪽 화살표  
            RIGHT: 'ArrowRight', // 오른쪽 화살표
            BOTTOM: 'ArrowDown'  // 아래쪽 화살표
        };
        
        // 오른쪽 클릭으로 팬 이동 가능
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,    // 왼쪽 버튼: 회전
            MIDDLE: THREE.MOUSE.DOLLY,   // 휠: 줌
            RIGHT: THREE.MOUSE.PAN       // 오른쪽 버튼: 팬
        };

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
        // 높은 강도의 주변광으로 그라데이션 최소화 및 디테일 향상
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        // 다방향 방향성 조명으로 모든 면을 균등하게 조명
        const lights = [
            { pos: [5000, 5000, 5000], intensity: 0.4 },   // 우상단
            { pos: [-5000, 5000, 5000], intensity: 0.4 },  // 좌상단  
            { pos: [5000, -5000, 5000], intensity: 0.3 },  // 우하단
            { pos: [-5000, -5000, 5000], intensity: 0.3 }, // 좌하단
            { pos: [0, 0, -5000], intensity: 0.2 }         // 후면
        ];

        lights.forEach(({ pos, intensity }) => {
            const light = new THREE.DirectionalLight(0xffffff, intensity);
            light.position.set(pos[0], pos[1], pos[2]);
            light.castShadow = false; // 그림자 비활성화로 선명한 형상 인식
            this.scene.add(light);
        });

        // 추가 헤미스피어 라이트로 자연스러운 조명 분위기
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
        this.scene.add(hemisphereLight);
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
        
        // 철근 감지 로직 (요소 이름이나 타입으로 판단)
        const isRebar = this.detectRebar(elementId, elementData);
        
        if (isRebar) {
            return this.createRebarElement(elementId, elementData);
        }
        
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
                
            case 'rebar':
                // 철근 배치 - 기존 구조물 내부에 배치
                const rebarSpacing = 0.5; // 0.5m 간격
                const rebarGridSize = Math.ceil(Math.sqrt(50)); // 50개 철근
                const rebarRow = Math.floor(counter / rebarGridSize);
                const rebarCol = counter % rebarGridSize;
                
                mesh.position.set(
                    rebarCol * rebarSpacing - (rebarGridSize * rebarSpacing) / 2,
                    1 + (counter % 5) * 0.6, // 다층으로 배치
                    rebarRow * rebarSpacing - (rebarGridSize * rebarSpacing) / 2
                );
                
                // 철근은 회전시켜서 다양한 방향으로 배치
                mesh.rotation.x = (counter % 3) * Math.PI / 6;
                mesh.rotation.y = (counter % 7) * Math.PI / 4;
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
            beam: 0xFF9500,      // 주황색 (보)
            column: 0x007AFF,    // 파란색 (기둥)
            slab: 0x34C759,      // 초록색 (슬래브)
            wall: 0xFF3B30,      // 빨간색 (벽)
            rebar: 0x444444,     // 진한 회색 (철근)
            generic: 0x8E8E93    // 회색 (기타)
        };

        const color = colors[elementType] || colors.generic;
        
        // MeshPhongMaterial로 변경하여 더 선명한 형상 표현
        return new THREE.MeshPhongMaterial({ 
            color: color,
            shininess: 30,       // 적당한 반사도로 형상 강조
            transparent: false,   // 투명도 비활성화
            opacity: 1.0,        // 완전 불투명
            flatShading: false,  // 부드러운 셰이딩으로 형상 디테일 보존
            side: THREE.DoubleSide, // 양면 렌더링으로 내부도 보이게
            vertexColors: false   // 정확한 색상 표현
        });
    }

    detectRebar(elementId, elementData) {
        // 철근 감지 로직 - 여러 방법으로 철근 판단
        const rebarKeywords = ['rebar', 'reinforcement', 'bar', '철근', 'steel', 'rod'];
        const rebarTypes = ['rebar', 'reinforcement', 'reinforcing_bar', 'steel_bar'];
        
        // 1. 요소 ID에서 철근 키워드 검색
        const idLower = elementId.toLowerCase();
        const hasRebarInId = rebarKeywords.some(keyword => idLower.includes(keyword));
        
        // 2. 요소 타입에서 철근 타입 검색
        const typeLower = (elementData.type || '').toLowerCase();
        const hasRebarType = rebarTypes.some(type => typeLower.includes(type));
        
        // 3. 형상 분석 - 긴 원통형이면 철근일 가능성 높음
        const isLongCylindrical = this.analyzeCylindricalShape(elementData);
        
        return hasRebarInId || hasRebarType || isLongCylindrical;
    }

    analyzeCylindricalShape(elementData) {
        // 단순한 형상 분석 - 길이 대 너비 비율이 큰 경우 철근으로 판단
        if (!elementData.boundingBox) return false;
        
        const box = elementData.boundingBox;
        if (!box.min || !box.max) return false;
        
        const dimensions = [
            Math.abs(box.max[0] - box.min[0]),
            Math.abs(box.max[1] - box.min[1]),
            Math.abs(box.max[2] - box.min[2])
        ];
        
        dimensions.sort((a, b) => b - a); // 내림차순 정렬
        const aspectRatio = dimensions[0] / dimensions[1];
        
        // 길이 대 너비 비율이 10:1 이상이고 가장 긴 치수가 100mm 이상이면 철근으로 판단
        return aspectRatio > 10 && dimensions[0] > 100;
    }

    createRebarElement(elementId, elementData) {
        console.log(`🔩 Creating rebar element ${elementId}`);
        
        let geometry;
        
        // CHD 데이터에서 철근 형상 생성
        if (elementData.vertices && elementData.vertices.length > 0) {
            geometry = new THREE.BufferGeometry();
            const vertices = [];
            
            for (const vertex of elementData.vertices) {
                vertices.push(vertex[0], vertex[1], vertex[2]);
            }
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            
            if (elementData.faces && elementData.faces.length > 0) {
                const indices = [];
                for (const face of elementData.faces) {
                    indices.push(face[0], face[1], face[2]);
                }
                geometry.setIndex(indices);
            }
            
            geometry.computeVertexNormals();
        } else {
            // 기본 철근 형상 생성 (원통형)
            geometry = new THREE.CylinderGeometry(
                8,    // 반지름 상단 (8mm)
                8,    // 반지름 하단 (8mm) 
                1000, // 높이 (1m)
                8     // 원형 분할 수
            );
        }
        
        // 철근 전용 재질 생성
        const rebarMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x444444,      // 진한 회색
            shininess: 80,        // 금속성 반사
            transparent: false,
            opacity: 1.0,
            metalness: 0.8,       // 금속성 강조
            roughness: 0.3        // 표면 거칠기
        });
        
        const mesh = new THREE.Mesh(geometry, rebarMaterial);
        
        mesh.userData = {
            elementId: elementId,
            elementType: 'rebar',
            originalMaterial: rebarMaterial,
            isRebar: true
        };
        
        // 철근은 작으므로 위치를 조정
        if (elementData.vertices && elementData.vertices.length > 0) {
            console.log(`Element ${elementId} uses vertex positions directly`);
        } else {
            // 기본 위치 설정
            this.positionElement(mesh, 'rebar');
        }
        
        console.log(`Created rebar element ${elementId} with ${elementData.vertices?.length || 0} vertices`);
        this.elements.set(elementId, mesh);
        this.scene.add(mesh);
        
        return mesh;
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

    toggleRebarVisibility() {
        // 철근 가시성 상태 초기화 (없으면 기본 true)
        if (this.rebarVisible === undefined) {
            this.rebarVisible = true;
        }
        
        this.rebarVisible = !this.rebarVisible;
        
        // 모든 철근 요소의 가시성 토글
        for (const mesh of this.elements.values()) {
            if (mesh.userData.isRebar || mesh.userData.elementType === 'rebar') {
                mesh.visible = this.rebarVisible;
            }
        }
        
        console.log(`🔩 Rebar visibility: ${this.rebarVisible ? 'ON' : 'OFF'}`);
        return this.rebarVisible;
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