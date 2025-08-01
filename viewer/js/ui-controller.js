/**
 * UI Controller for CHD Viewer
 */

export class UIController {
    constructor() {
        this.elements = {
            loadFileBtn: document.getElementById('loadFileBtn'),
            loadFolderBtn: document.getElementById('loadFolderBtn'),
            refreshProjectsBtn: document.getElementById('refreshProjectsBtn'),
            projectSelect: document.getElementById('projectSelect'),
            loadProjectBtn: document.getElementById('loadProjectBtn'),
            fileInput: document.getElementById('fileInput'),
            folderInput: document.getElementById('folderInput'),
            fileInfo: document.getElementById('fileInfo'),
            fileName: document.getElementById('fileName'),
            fileStats: document.getElementById('fileStats'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            resetViewBtn: document.getElementById('resetViewBtn'),
            fitViewBtn: document.getElementById('fitViewBtn'),
            wireframeBtn: document.getElementById('wireframeBtn'),
            rebarToggleBtn: document.getElementById('rebarToggleBtn'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),
            modelInfo: document.getElementById('modelInfo'),
            elementList: document.getElementById('elementList'),
            elementTypeFilter: document.getElementById('elementTypeFilter'),
            elementSearch: document.getElementById('elementSearch'),
            propertiesPanel: document.getElementById('propertiesPanel'),
            materialsPanel: document.getElementById('materialsPanel'),
            elementCount: document.getElementById('elementCount'),
            vertexCount: document.getElementById('vertexCount'),
            faceCount: document.getElementById('faceCount'),
            selectedElement: document.getElementById('selectedElement'),
            memoryUsage: document.getElementById('memoryUsage'),
            cameraInfo: document.getElementById('cameraInfo'),
            performanceInfo: document.getElementById('performanceInfo')
        };

        this.currentModel = null;
        this.filteredElements = [];
        this.selectedElementId = null;

        this.onLoadFile = null;
        this.onLoadTest = null;
        this.onElementSelect = null;
        this.onResetView = null;
        this.onFitView = null;
        this.onToggleWireframe = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // File loading
        this.elements.loadFileBtn.addEventListener('click', () => {
            this.elements.fileInput.click();
        });

        this.elements.loadFolderBtn.addEventListener('click', () => {
            this.elements.folderInput.click();
        });

        this.elements.fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && this.onLoadFile) {
                this.onLoadFile(file);
            }
        });

        this.elements.folderInput.addEventListener('change', (event) => {
            const files = Array.from(event.target.files);
            if (files.length > 0 && this.onLoadFile) {
                // CHD 폴더 구조 처리
                this.onLoadFile(files);
            }
        });

        // Project management
        this.elements.refreshProjectsBtn.addEventListener('click', () => {
            this.loadProjectList();
        });

        this.elements.loadProjectBtn.addEventListener('click', () => {
            const selectedProject = this.elements.projectSelect.value;
            if (selectedProject && this.onLoadProject) {
                this.onLoadProject(selectedProject);
            } else if (!selectedProject) {
                alert('Please select a CHD project from the dropdown first.');
            }
        });

        // Viewport controls
        this.elements.resetViewBtn.addEventListener('click', () => {
            if (this.onResetView) {
                this.onResetView();
            }
        });

        this.elements.fitViewBtn.addEventListener('click', () => {
            if (this.onFitView) {
                this.onFitView();
            }
        });

        this.elements.wireframeBtn.addEventListener('click', () => {
            if (this.onToggleWireframe) {
                const isWireframe = this.onToggleWireframe();
                this.elements.wireframeBtn.classList.toggle('active', isWireframe);
            }
        });

        this.elements.rebarToggleBtn.addEventListener('click', () => {
            if (this.onToggleRebar) {
                const isRebarVisible = this.onToggleRebar();
                this.elements.rebarToggleBtn.classList.toggle('active', isRebarVisible);
            }
        });

        this.elements.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Element filtering
        this.elements.elementTypeFilter.addEventListener('change', () => {
            this.filterElements();
        });

        this.elements.elementSearch.addEventListener('input', () => {
            this.filterElements();
        });
    }

    showLoading(message = 'Loading...') {
        this.elements.loadingOverlay.style.display = 'flex';
        this.updateProgress(message, 0);
    }

    hideLoading() {
        this.elements.loadingOverlay.style.display = 'none';
    }

    updateProgress(message, percentage) {
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${percentage}%`;
        }
        if (this.elements.progressText) {
            this.elements.progressText.textContent = `${percentage}%`;
        }
        // Update loading text if available
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    updateFileInfo(fileName, stats) {
        this.elements.fileName.textContent = fileName;
        this.elements.fileStats.textContent = `${stats.total_elements} elements, ${stats.total_vertices} vertices`;
        this.elements.fileInfo.style.display = 'flex';
    }

    updateModelInfo(model) {
        this.currentModel = model;
        
        const info = `
            <div class="info-item">
                <strong>Project:</strong> ${model.project?.name || 'Unnamed'}
            </div>
            <div class="info-item">
                <strong>Format:</strong> ${model.format} v${model.version}
            </div>
            <div class="info-item">
                <strong>Units:</strong> ${model.project?.units || 'Unknown'}
            </div>
            <div class="info-item">
                <strong>Coordinate System:</strong> ${model.project?.coordinate_system || 'Unknown'}
            </div>
        `;
        
        this.elements.modelInfo.innerHTML = info;
        this.updateElementList();
        this.updateMaterialsList();
    }

    updateElementList() {
        if (!this.currentModel) return;

        const elements = [];
        for (const [chunkId, chunk] of Object.entries(this.currentModel.geometry || {})) {
            if (chunk.elements) {
                for (const [elementId, element] of Object.entries(chunk.elements)) {
                    elements.push({
                        id: elementId,
                        type: element.type,
                        name: elementId,
                        vertices: element.vertices?.length || 0,
                        faces: element.faces?.length || 0
                    });
                }
            }
        }

        this.filteredElements = elements;
        this.renderElementList();
    }

    filterElements() {
        if (!this.currentModel) return;

        const typeFilter = this.elements.elementTypeFilter.value;
        const searchText = this.elements.elementSearch.value.toLowerCase();

        let elements = [];
        for (const [chunkId, chunk] of Object.entries(this.currentModel.geometry || {})) {
            if (chunk.elements) {
                for (const [elementId, element] of Object.entries(chunk.elements)) {
                    elements.push({
                        id: elementId,
                        type: element.type,
                        name: elementId,
                        vertices: element.vertices?.length || 0,
                        faces: element.faces?.length || 0
                    });
                }
            }
        }

        // Apply filters
        this.filteredElements = elements.filter(element => {
            const matchesType = !typeFilter || element.type === typeFilter;
            const matchesSearch = !searchText || 
                element.id.toLowerCase().includes(searchText) ||
                element.type.toLowerCase().includes(searchText);
            
            return matchesType && matchesSearch;
        });

        this.renderElementList();
    }

    renderElementList() {
        if (this.filteredElements.length === 0) {
            this.elements.elementList.innerHTML = '<p>No elements to display</p>';
            return;
        }

        const html = this.filteredElements.map(element => `
            <div class="element-item" data-element-id="${element.id}">
                <div class="element-header">
                    <span class="element-id">${element.id}</span>
                    <span class="element-type ${element.type}">${element.type}</span>
                </div>
                <div class="element-info">
                    ${element.vertices} vertices, ${element.faces} faces
                </div>
            </div>
        `).join('');

        this.elements.elementList.innerHTML = html;

        // Add click listeners
        this.elements.elementList.querySelectorAll('.element-item').forEach(item => {
            item.addEventListener('click', () => {
                const elementId = item.dataset.elementId;
                this.selectElement(elementId);
            });
        });
    }

    selectElement(elementId) {
        // Update visual selection
        this.elements.elementList.querySelectorAll('.element-item').forEach(item => {
            item.classList.remove('selected');
        });

        const selectedItem = this.elements.elementList.querySelector(`[data-element-id="${elementId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        this.selectedElementId = elementId;
        this.updatePropertiesPanel();

        // Callback
        if (this.onElementSelect) {
            this.onElementSelect(elementId);
        }
    }

    updatePropertiesPanel() {
        if (!this.selectedElementId || !this.currentModel) {
            this.elements.propertiesPanel.innerHTML = '<p>Select an element to view properties</p>';
            return;
        }

        // Find element data
        let elementData = null;
        for (const chunk of Object.values(this.currentModel.geometry || {})) {
            if (chunk.elements && chunk.elements[this.selectedElementId]) {
                elementData = chunk.elements[this.selectedElementId];
                break;
            }
        }

        if (!elementData) {
            this.elements.propertiesPanel.innerHTML = '<p>Element data not found</p>';
            return;
        }

        // Get properties from attributes
        const properties = this.currentModel.attributes?.properties?.elements?.[this.selectedElementId] || {};

        const html = `
            <div class="property-group">
                <h4>Basic Properties</h4>
                <div class="property-item">
                    <span class="property-label">ID:</span>
                    <span class="property-value">${elementData.id}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Type:</span>
                    <span class="property-value">${elementData.type}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Name:</span>
                    <span class="property-value">${properties.name || elementData.id}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Level:</span>
                    <span class="property-value">${properties.level || 'Unknown'}</span>
                </div>
            </div>
            <div class="property-group">
                <h4>Geometry</h4>
                <div class="property-item">
                    <span class="property-label">Vertices:</span>
                    <span class="property-value">${elementData.vertices?.length || 0}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Faces:</span>
                    <span class="property-value">${elementData.faces?.length || 0}</span>
                </div>
            </div>
        `;

        this.elements.propertiesPanel.innerHTML = html;
    }

    updateMaterialsList() {
        if (!this.currentModel?.attributes?.materials?.materials) {
            this.elements.materialsPanel.innerHTML = '<p>No materials loaded</p>';
            return;
        }

        const materials = this.currentModel.attributes.materials.materials;
        const html = Object.entries(materials).map(([id, material]) => `
            <div class="material-item">
                <div class="material-name">${material.name || id}</div>
                <div class="material-type">${material.type || 'Unknown'}</div>
                <div style="display: flex; align-items: center;">
                    <div class="material-swatch" style="background-color: rgb(${(material.properties?.color || [0.7, 0.7, 0.7]).slice(0, 3).map(c => Math.round(c * 255)).join(',')})"></div>
                    <span style="font-size: 12px; color: #8E8E93;">${material.properties?.density || 'N/A'} kg/m³</span>
                </div>
            </div>
        `).join('');

        this.elements.materialsPanel.innerHTML = html;
    }

    updateStats(stats) {
        this.elements.elementCount.textContent = `Elements: ${stats.total_elements || 0}`;
        this.elements.vertexCount.textContent = `Vertices: ${(stats.total_vertices || 0).toLocaleString()}`;
        this.elements.faceCount.textContent = `Faces: ${(stats.total_faces || 0).toLocaleString()}`;
        
        if (this.selectedElementId) {
            this.elements.selectedElement.textContent = `Selected: ${this.selectedElementId}`;
        } else {
            this.elements.selectedElement.textContent = 'No selection';
        }
    }

    updatePerformanceInfo(rendererStats) {
        if (this.elements.performanceInfo) {
            this.elements.performanceInfo.textContent = `FPS: ${rendererStats.fps || 0}`;
        }
        
        if (this.elements.memoryUsage) {
            const memoryMB = ((rendererStats.geometries || 0) * 50) / 1000; // Rough estimate
            this.elements.memoryUsage.textContent = `Memory: ${memoryMB.toFixed(1)} MB`;
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    showError(message) {
        // Simple error display - could be enhanced with a modal
        alert(`Error: ${message}`);
    }

    showInfo(message) {
        // Simple info display - could be enhanced with a modal
        alert(`Info: ${message}`);
    }

    showConversionInfo(conversionInfo) {
        // Create conversion info notification
        const notification = document.createElement('div');
        notification.className = 'conversion-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>🔄 File Converted Successfully!</h4>
                <p><strong>Original:</strong> ${conversionInfo.originalFile}</p>
                <p><strong>From:</strong> ${conversionInfo.convertedFrom} format</p>
                <p><strong>Elements:</strong> ${conversionInfo.statistics?.total_elements || 'N/A'}</p>
                <button class="close-notification" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add styles if not already added
        if (!document.querySelector('#conversion-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'conversion-notification-styles';
            styles.textContent = `
                .conversion-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #4CAF50;
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 1000;
                    max-width: 300px;
                    animation: slideIn 0.3s ease-out;
                }
                
                .notification-content h4 {
                    margin: 0 0 10px 0;
                    font-size: 16px;
                }
                
                .notification-content p {
                    margin: 5px 0;
                    font-size: 14px;
                }
                
                .close-notification {
                    position: absolute;
                    top: 5px;
                    right: 10px;
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    width: 25px;
                    height: 25px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        console.log('Conversion info displayed:', conversionInfo);
    }

    // Project management methods
    async loadProjectList() {
        try {
            console.log('🔄 Loading CHD project list...');
            const response = await fetch('/api/projects');
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load projects');
            }
            
            this.updateProjectSelect(data.projects);
            console.log(`✅ Loaded ${data.projects.length} CHD projects`);
            
        } catch (error) {
            console.error('Failed to load project list:', error);
            this.showError(`Failed to load projects: ${error.message}`);
        }
    }

    updateProjectSelect(projects) {
        const select = this.elements.projectSelect;
        
        // Clear existing options except the first one
        select.innerHTML = '<option value="">Choose CHD Project...</option>';
        
        if (projects.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No CHD projects found';
            option.disabled = true;
            select.appendChild(option);
            return;
        }
        
        // Add project options
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.name;
            
            const projectName = project.manifest?.project?.name || project.name.replace('.chd', '');
            const elementCount = project.manifest?.statistics?.total_elements || 0;
            const memoryInfo = project.statistics?.memoryFormatted || '';
            
            option.textContent = `${projectName} (${elementCount} elements, ${memoryInfo})`;
            option.title = `
Source: ${project.manifest?.source?.originalFile || 'Unknown'}
Created: ${project.manifest?.source?.conversionTime || 'Unknown'}
Size: ${project.statistics?.sizeFormatted || 'Unknown'}
Memory: ${project.statistics?.memoryFormatted || 'Unknown'}
            `.trim();
            
            select.appendChild(option);
        });
    }

    // Initialize project list on startup
    init() {
        this.loadProjectList();
    }
}