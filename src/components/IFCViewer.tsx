// src/components/IFCViewer.tsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import Stats from 'stats.js';

// 3D 엔진 관련 클래스들
import {
  Components,
  Worlds,
  SimpleScene,
  SimpleCamera,
  SimpleRenderer,
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
    const components = new Components();
    const worlds = components.get(Worlds);
    const world = worlds.create<SimpleScene, SimpleCamera, SimpleRenderer>();

    // Scene, Renderer, Camera 생성 및 연결
    world.scene = new SimpleScene(components);
    world.renderer = new SimpleRenderer(components, containerRef.current);
    world.camera = new SimpleCamera(components);

    // 3D world 초기화 시작
    components.init();

    // 기본 Scene 설정 (조명, 배경 등)
    world.scene.setup();
    world.scene.three.background = null; // 배경을 투명하게 설정

    // ──────────────────────────────────────────────
    // 2. 3D 객체 추가 (Cube 예시)
    // ──────────────────────────────────────────────
    const cubeMaterial = new THREE.MeshLambertMaterial({
      color: '#6528D7',
      transparent: true,
      opacity: 0.2,
    });
    const cubeGeometry = new THREE.BoxGeometry();
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.rotation.set(Math.PI / 4.2, Math.PI / 4.2, Math.PI / 4.2);
    cube.updateMatrixWorld();
    world.scene.three.add(cube);

    // 카메라가 Cube를 바라보도록 설정
    world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

    // ──────────────────────────────────────────────
    // 3. 성능 측정 (Stats.js)
    // ──────────────────────────────────────────────
    const stats = new Stats();
    stats.showPanel(2);
    document.body.appendChild(stats.dom);
    stats.dom.style.left = '0px';
    stats.dom.style.zIndex = 'unset';
    world.renderer.onBeforeUpdate.add(() => stats.begin());
    world.renderer.onAfterUpdate.add(() => stats.end());

    // ──────────────────────────────────────────────
    // 4. UI 초기화 및 패널/버튼 추가
    // ──────────────────────────────────────────────
    // UI 라이브러리 초기화
    Manager.init();

    // 옵션 패널 생성 (배경색, 조명 강도 조절)
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

    // 모바일 등에서 메뉴 토글용 버튼 생성
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
    // 5. Cleanup: 컴포넌트 언마운트 시 DOM 및 리소스 정리
    // ──────────────────────────────────────────────
    return () => {
      if (stats.dom.parentNode) stats.dom.parentNode.removeChild(stats.dom);
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      if (button.parentNode) button.parentNode.removeChild(button);
      // 필요 시 components.dispose()를 호출해 3D 관련 리소스 해제
      components.dispose && components.dispose();
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />;
};

export default IFCViewer;
