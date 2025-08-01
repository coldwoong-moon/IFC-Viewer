/**
 * CHD Viewer Application
 * Main application that coordinates all components
 */

import { CHDLoader } from './chd-loader.js';
import { ThreeRenderer } from './three-renderer.js';
import { UIController } from './ui-controller.js';

class ViewerApp {
    constructor() {
        this.loader = null;
        this.renderer = null;
        this.ui = null;
        this.currentModel = null;

        this.init();
    }

    async init() {
        try {
            // Initialize canvas
            const canvas = document.getElementById('viewport');
            if (!canvas) {
                throw new Error('Viewport canvas not found');
            }

            // Initialize components
            this.loader = new CHDLoader();
            this.renderer = new ThreeRenderer(canvas);
            this.ui = new UIController();

            // Setup event handlers
            this.setupEventHandlers();

            console.log('CHD Viewer initialized successfully');

            // Initialize UI (load project list) and then load test model
            setTimeout(() => {
                this.ui.init(); // Load CHD project list
                this.loadTestModel();
            }, 1000);

        } catch (error) {
            console.error('Failed to initialize CHD Viewer:', error);
            this.showError('Failed to initialize viewer: ' + error.message);
        }
    }

    setupEventHandlers() {
        // UI to app communication
        this.ui.onLoadFile = (file) => this.loadFile(file);
        this.ui.onLoadProject = (projectName) => this.loadProject(projectName);
        this.ui.onElementSelect = (elementId) => this.selectElement(elementId);
        this.ui.onResetView = () => this.renderer.resetCamera();
        this.ui.onFitView = () => this.renderer.fitCameraToScene();
        this.ui.onToggleWireframe = () => this.renderer.toggleWireframe();
        this.ui.onToggleRebar = () => this.renderer.toggleRebarVisibility();

        // Renderer to UI communication
        this.renderer.onElementSelect = (elementId) => {
            this.ui.selectElement(elementId);
        };

        // Performance monitoring
        setInterval(() => {
            this.updatePerformanceStats();
        }, 1000);
    }

    async loadFile(file) {
        try {
            this.ui.showLoading('Loading CHD file...');

            const model = await this.loader.loadFromFile(file, (progress) => {
                this.ui.updateProgress(progress.message, progress.percentage);
            });

            console.log(`📦 Model loaded:`, model);
            console.log(`📊 Model statistics:`, model.statistics);
            await this.displayModel(model, file.name);

        } catch (error) {
            console.error('Failed to load file:', error);
            this.ui.showError('Failed to load file: ' + error.message);
        } finally {
            this.ui.hideLoading();
        }
    }

    async loadServerFile(filePath) {
        try {
            const fileName = filePath.split('/').pop();
            this.ui.showLoading(`Loading ${fileName}...`);
            
            // Load from server using the file path
            const model = await this.loader.loadFromServer('/api/load-chd', filePath);
            await this.displayModel(model, fileName);
        } catch (error) {
            console.error('Failed to load server file:', error);
            this.ui.showError('Failed to load server file: ' + error.message);
        } finally {
            this.ui.hideLoading();
        }
    }

    async loadProject(projectName) {
        try {
            this.ui.showLoading(`Loading CHD project: ${projectName}...`);

            console.log(`📂 Loading CHD project: ${projectName}`);

            const response = await fetch('/api/load-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ projectName })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to load project: ${response.status}`);
            }

            const model = await response.json();
            console.log(`📦 CHD project loaded:`, model.projectInfo);

            await this.displayModel(model, projectName);

            // Show project info if available
            if (model.projectInfo && model.projectInfo.manifest.source) {
                this.ui.updateFileInfo(projectName, {
                    ...model.statistics,
                    projectInfo: model.projectInfo,
                    conversionInfo: model.projectInfo.manifest.source
                });
            }

        } catch (error) {
            console.error('Failed to load CHD project:', error);
            this.ui.showError(`Failed to load CHD project: ${error.message}`);
        } finally {
            this.ui.hideLoading();
        }
    }

    async loadTestModel() {
        try {
            this.ui.showLoading('Loading test model...');

            // Try to load from server, fallback to demo model
            const model = await this.loader.loadFromServer('/api/load-chd', 'test2.chd');

            await this.displayModel(model, 'test2.chd');

        } catch (error) {
            console.error('Failed to load test model:', error);
            this.ui.showError('Failed to load test model: ' + error.message);
        } finally {
            this.ui.hideLoading();
        }
    }

    async displayModel(model, fileName) {
        console.log(`🎨 Starting to display model: ${fileName}`);
        
        if (!model) {
            console.error('❌ No model data received');
            throw new Error('No model data received');
        }

        // IFC 파일이 CHD 프로젝트로 변환된 경우 특별 처리
        if (model.isProjectCreated && model.conversionInfo) {
            console.log('🎯 IFC file converted to CHD project');
            
            // 사용자에게 프로젝트 생성 알림
            const message = model.conversionInfo.message || 'CHD 프로젝트가 생성되었습니다.';
            this.ui.showInfo(message + ' 프로젝트 목록을 새로고침합니다.');
            
            // 프로젝트 목록 새로고침
            setTimeout(() => {
                this.ui.loadProjectList();
            }, 1000);
            
            // 변환 정보 표시
            if (model.conversionInfo) {
                this.ui.showConversionInfo(model.conversionInfo);
            }
            
            // 변환된 프로젝트가 있으면 자동으로 로드하여 3D 렌더링
            if (model.conversionInfo && model.conversionInfo.projectName) {
                console.log('🔄 Auto-loading converted project for 3D rendering...');
                setTimeout(() => {
                    this.loadProject(model.conversionInfo.projectName);
                }, 1500);
                return;
            }
        }

        console.log(`📝 Model has ${Object.keys(model.geometry || {}).length} geometry chunks`);
        this.currentModel = model;

        // Update UI with model info
        const stats = this.loader.getStatistics() || {
            total_elements: 0,
            total_vertices: 0,
            total_faces: 0
        };

        this.ui.updateFileInfo(fileName, stats);
        this.ui.updateModelInfo(model);
        this.ui.updateStats(stats);
        
        // Show conversion info if model was converted from IFC
        if (model.conversionInfo) {
            this.ui.showConversionInfo(model.conversionInfo);
        }

        // Load model into 3D renderer
        this.renderer.loadModel(model);

        console.log('Model displayed successfully:', {
            elements: stats.total_elements,
            vertices: stats.total_vertices,
            faces: stats.total_faces
        });
    }

    selectElement(elementId) {
        if (this.renderer) {
            this.renderer.selectElement(elementId);
        }
    }

    updatePerformanceStats() {
        if (this.renderer) {
            const stats = this.renderer.getStats();
            this.ui.updatePerformanceInfo(stats);
        }
    }

    showError(message) {
        this.ui.showError(message);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.viewerApp = new ViewerApp();
});

export { ViewerApp };