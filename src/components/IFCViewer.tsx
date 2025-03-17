// src/components/IFCViewer.tsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import Stats from 'stats.js';

import * as OBC from "@thatopen/components";
import * as WEBIFC from "web-ifc";
import * as BUI from "@thatopen/ui";

// 3D 엔진 관련 클래스들
import {
  Components,
  Worlds,
  SimpleScene,
  SimpleCamera,
  SimpleRenderer,
  IfcLoader, // 내장된 IfcLoader 기능 사용
} from '@thatopen/components';

// UI 관련 기능들
import { Manager, Component, html } from '@thatopen/ui';

// 맨 위에 필요한 경우 window.gc 타입 정의 추가
declare global {
  interface Window {
    gc?: () => void;
  }
}

const IFCViewer: React.FC = () => {
  // 3D 렌더링을 위한 컨테이너 ref
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // ──────────────────────────────────────────────
    // 1. 3D World 초기화
    // ──────────────────────────────────────────────
    const ifcComponents = new OBC.Components();
    const ifcLoader = ifcComponents.get(OBC.IfcLoader);
    const worlds = ifcComponents.get(Worlds);
    const world = worlds.create<SimpleScene, SimpleCamera, SimpleRenderer>();

    // Scene, Renderer, Camera 생성 및 연결
    world.scene = new SimpleScene(ifcComponents);
    world.renderer = new SimpleRenderer(ifcComponents, containerRef.current);
    world.camera = new SimpleCamera(ifcComponents);

    // 3D world 초기화 시작
    ifcComponents.init();

    // 기본 Scene 설정 (조명, 배경 등)
    world.scene.setup();
    world.scene.three.background = new THREE.Color("Gray"); // 원래 그레이 배경으로 복원
    world.renderer.three.setClearColor(0xAAAAAA, 1); // 그레이 색상으로 렌더러 설정

    // 성능 최적화를 위한 렌더러 설정
    world.renderer.three.shadowMap.enabled = false; // 그림자 맵 비활성화로 성능 향상
    // 안티앨리어싱 설정 (하드웨어 지원이 되면 활성화)
    if (window.navigator.hardwareConcurrency > 4) {
      world.renderer.three.antialias = true;
    } else {
      world.renderer.three.antialias = false;
    }

    // 카메라 설정
    world.camera.controls.smoothTime = 0.25; // 더 빠른 반응성
    world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

    // 디버깅 헬퍼 추가 - 그리드와 축 표시
    const gridHelper = new THREE.GridHelper(20, 20);
    world.scene.three.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(5);
    world.scene.three.add(axesHelper);

    // ──────────────────────────────────────────────
    // 2. 성능 측정 (Stats.js)
    // ──────────────────────────────────────────────
    const stats = new Stats();
    stats.showPanel(2);
    document.body.appendChild(stats.dom);
    stats.dom.style.left = '0px';
    stats.dom.style.zIndex = 'unset';
    world.renderer.onBeforeUpdate.add(() => stats.begin());
    world.renderer.onAfterUpdate.add(() => stats.end());

    // ──────────────────────────────────────────────
    // 3. UI 초기화 및 패널/버튼 추가
    // ──────────────────────────────────────────────
    Manager.init();

    const panel = Component.create(() => {
      return html`
        <bim-panel label="Worlds Tutorial" class="options-menu">
          <bim-panel-section collapsed label="Controls">
            <bim-color-input
              label="Background Color"
              color="#202932"
              @input="${({ target }: { target: any }) => {
                world.scene.config.backgroundColor = new THREE.Color(target.color);
              }}"
            ></bim-color-input>
            <bim-number-input
              slider
              step="0.1"
              label="Directional lights intensity"
              value="1.5"
              min="0.1"
              max="10"
              @change="${({ target }: { target: any }) => {
                world.scene.config.directionalLight.intensity = target.value;
              }}"
            ></bim-number-input>
            <bim-number-input
              slider
              step="0.1"
              label="Ambient light intensity"
              value="1"
              min="0.1"
              max="5"
              @change="${({ target }: { target: any }) => {
                world.scene.config.ambientLight.intensity = target.value;
              }}"
            ></bim-number-input>
          </bim-panel-section>
        </bim-panel>
      `;
    });
    document.body.appendChild(panel);

    const button = Component.create(() => {
      return html`
        <bim-button class="phone-menu-toggler" icon="solar:settings-bold"
          @click="${() => {
            panel.classList.toggle('options-menu-visible');
          }}"
        ></bim-button>
      `;
    });
    document.body.appendChild(button);

    // ──────────────────────────────────────────────
    // 4. IFC 파일 입력 처리
    // ──────────────────────────────────────────────
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.ifc';
    fileInput.style.position = 'fixed';
    fileInput.style.top = '10px';
    fileInput.style.right = '10px';
    fileInput.style.zIndex = '1000';
    fileInput.style.padding = '10px';
    fileInput.style.backgroundColor = '#ffffff';
    fileInput.style.border = '1px solid #ccc';
    fileInput.style.borderRadius = '4px';
    document.body.appendChild(fileInput);
    const model_name = "RPMS";

    fileInput.addEventListener('change', async (event) => {
      let loadingText: HTMLDivElement | null = null;

      try {
        const target = event.target as HTMLInputElement;
        if (!target.files?.length) return;

        const file = target.files[0];
        console.log('파일 선택됨:', file.name);

        fileInput.disabled = true;
        loadingText = document.createElement('div');
        loadingText.id = 'ifc-loading-text';
        loadingText.textContent = 'IFC 파일 로딩 중...';
        loadingText.style.position = 'fixed';
        loadingText.style.top = '50px';
        loadingText.style.right = '10px';
        document.body.appendChild(loadingText);

        // 기존 모델 제거
        const existingModel = world.scene.three.getObjectByName(model_name);
        if (existingModel) {
          world.scene.three.remove(existingModel);
          ifcLoader.cleanUp();
        }

        console.log('IFC 로더 설정 시작');
        await ifcLoader.setup();
        console.log('IFC 로더 설정 완료');

        console.log('파일 데이터 로딩 시작');
        // 변수 스코프를 제한하여 메모리 관리
        let ifcModel;
        {
          const data = await file.arrayBuffer();
          const buffer = new Uint8Array(data);
          console.log('파일 데이터 준비 완료, 크기:', buffer.length);
          
          // 모델 로드
          console.log('IFC 모델 로딩 시작...');
          ifcModel = await ifcLoader.load(buffer);
          console.log('IFC 모델 로드됨:', ifcModel);
          
          // 모델 로드 후 메모리에서 버퍼 참조 해제
          // 상수 변수를 null로 설정하려고 시도하지 않음
        }
        
        // 여기서 garbage collector가 data와 buffer를 수집할 수 있음

        ifcModel.name = model_name;
        
        // 머티리얼 최적화 - 성능 중심으로 설정
        ifcModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                // 원본 머티리얼 속성 유지, 필수 속성만 설정
                mat.side = THREE.FrontSide; // 단면 렌더링으로 성능 향상
                mat.needsUpdate = true;
              });
            } else if (child.material) {
              child.material.side = THREE.FrontSide; // 단면 렌더링으로 성능 향상
              child.material.needsUpdate = true;
            }
          }
        });
        
        // 모델 위치 조정
        ifcModel.position.set(0, 0, 0);
        world.scene.three.add(ifcModel);
        
        // 모델에 맞게 카메라 위치 자동 조정
        const box = new THREE.Box3().setFromObject(ifcModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // 카메라 거리 최적화
        const distance = maxDim * 1.5; // 더 가까운 거리로 변경
        
        // 카메라가 모델 중심을 바라보도록 설정
        world.camera.controls.setLookAt(
          center.x + distance * 0.7, 
          center.y + distance * 0.7,
          center.z + distance * 0.7,
          center.x, center.y, center.z
        );
        
        // 성능 최적화를 위한 추가 설정
        if (size.length() > 100) {
          // 매우 큰 모델의 경우 절두체 거리 조정으로 성능 향상
          world.camera.three.near = 1;
          world.camera.three.far = Math.max(1000, size.length() * 5);
          world.camera.three.updateProjectionMatrix();
        }
        
        // 메모리 최적화 - GC 힌트
        if (typeof window.gc === 'function') {
          window.gc();
        }
        
        // 강제 업데이트
        if (world.renderer) {
          console.log('씬 강제 업데이트');
          world.renderer.three.render(world.scene.three, world.camera.three);
        }
        
        // 컨트롤 업데이트 - 매개변수 없이 호출
        world.camera.controls.update();
        
        console.log('모델 로드 및 카메라 설정 완료');

      } catch (error) {
        console.error('IFC 로드 오류:', error);
        alert('IFC 파일 로드 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        fileInput.disabled = false;
        if (loadingText?.parentNode) {
          loadingText.parentNode.removeChild(loadingText);
        }
      }
    });

    const positionInit = document.createElement('button');
    positionInit.type = 'button';
    positionInit.style.position = 'fixed';
    positionInit.style.top = '10px';
    positionInit.style.right = '10px';
    positionInit.style.zIndex = '1000';
    positionInit.innerHTML = 'Position Init';
    positionInit.addEventListener('click', () => {
      world.scene.three.position.set(0, 0, 0);
      world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);
      world.camera.updateAspect()
    });
    document.body.appendChild(positionInit);

    // ──────────────────────────────────────────────
    // 5. Cleanup: 언마운트 시 DOM 및 리소스 정리
    // ──────────────────────────────────────────────
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
      if (stats.dom.parentNode) stats.dom.parentNode.removeChild(stats.dom);
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      if (button.parentNode) button.parentNode.removeChild(button);
      
      if (fileInput.parentNode) fileInput.parentNode.removeChild(fileInput);
      ifcComponents.dispose && ifcComponents.dispose();
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />;
};

export default IFCViewer;
