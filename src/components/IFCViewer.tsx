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
    world.scene.three.background = new THREE.Color("Gray"); // 배경을 투명하게 설정

    // 카메라가 초기 씬을 바라보도록 설정
    world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

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
    document.body.appendChild(fileInput);
    const model_name = "RPMS";

fileInput.addEventListener('change', async (event) => {
  const target = event.target as HTMLInputElement;
  if (target.files?.[0]) {
    try {
      // 이전 모델이 존재하면 제거하고 메모리 정리
      const existingModel = world.scene.three.getObjectByName(model_name);
      if (existingModel) {
        // IFC 모델의 지오메트리와 메터리얼 정리
        existingModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        // 씬에서 모델 제거
        world.scene.three.remove(existingModel);
        // IFC 로더의 메모리 정리
        ifcLoader.cleanUp();
      }

      const file = target.files[0];
      // IFC 모델 로드 및 씬에 추가
          await ifcLoader.setup();

          ifcLoader.isResizeable();
          ifcLoader.isUpdateable();
          
          const data = await file.arrayBuffer();
          const buffer = new Uint8Array(data);
          const ifcModel = await ifcLoader.load(buffer);

          ifcModel.name = model_name;
          
          world.scene.three.add(ifcModel);


          // 가비지 컬렉션 힌트
          if (typeof window.gc === 'function') {
            window.gc();
          }
        } catch (error) {
          console.error('IFC 파일 로드 중 오류 발생:', error);
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
