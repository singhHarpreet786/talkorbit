import { Component, AfterViewInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-planet',
  templateUrl: './planet.component.html',
  styleUrls: ['./planet.component.css']
})
export class PlanetComponent implements AfterViewInit {
  @ViewChild('threeCanvas') canvasRef!: ElementRef;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private planet!: THREE.Mesh;
  private satellite!: THREE.Mesh;
  private orbit!: THREE.Mesh;
  private planetSystemGroup!: THREE.Group;

  private clock = new THREE.Clock();
  private mouseX = 0;
  private mouseY = 0;
  private targetX = 0;
  private targetY = 0;
  private readonly canvasSize = 1000;
  private readonly windowHalfX = this.canvasSize / 2;
  private readonly windowHalfY = this.canvasSize / 2;

  constructor() {}

  ngAfterViewInit(): void {
    this.createScene();
    this.createObjects();
    this.animate();
  }

  private createScene(): void {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, this.canvasSize / this.canvasSize, 0.1, 1000);
    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvasRef.nativeElement });
    this.renderer.setSize(this.canvasSize/2, this.canvasSize/2);
    this.renderer.setClearColor(0xffffff, 1);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5).normalize();
    this.scene.add(directionalLight);
  }

  private createObjects(): void {
    this.planetSystemGroup = new THREE.Group();

    const planetGeometry = new THREE.SphereGeometry(1.3, 64, 64);
    const planetMaterial = new THREE.MeshPhongMaterial({ color: 0xe46b26 });
    this.planet = new THREE.Mesh(planetGeometry, planetMaterial);
    
    const satelliteGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const satelliteMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
    this.satellite = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
    
    const orbitGeometry = new THREE.TorusGeometry(2, 0.02, 16, 500);
    const orbitMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
    this.orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);

    this.planetSystemGroup.add(this.planet);
    this.planetSystemGroup.add(this.satellite);
    this.planetSystemGroup.add(this.orbit);

    const orbitTiltAngle = Math.PI / 1.8;
    this.planetSystemGroup.rotation.x = orbitTiltAngle;

    this.scene.add(this.planetSystemGroup);
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    this.planet.rotation.y += 0.5 * delta;

    const satelliteRadius = 2;
    this.satellite.position.x = Math.sin(time * 0.7) * satelliteRadius;
    this.satellite.position.y = Math.cos(time * 0.7) * satelliteRadius;
    this.satellite.position.z = 0;

    this.satellite.rotation.y += 1 * delta;

    const floatingSpeed = 0.5;
    const floatingAmplitude = 0.2;
    this.planetSystemGroup.position.y = Math.sin(time * floatingSpeed) * floatingAmplitude;

    this.targetX = this.mouseX * 0.001;
    this.targetY = this.mouseY * 0.001;
    this.camera.rotation.y += 0.15 * (this.targetX - this.camera.rotation.y);
    this.camera.rotation.x += 0.15 * (this.targetY - this.camera.rotation.x);

    this.renderer.render(this.scene, this.camera);
  }

  // @HostListener('document:mousemove', ['$event'])
  // onDocumentMouseMove(event: MouseEvent): void {
  //   const rect = this.renderer.domElement.getBoundingClientRect();
  //   this.mouseX = ((event.clientX - rect.left) / rect.width) * this.canvasSize - this.windowHalfX;
  //   this.mouseY = ((event.clientY - rect.top) / rect.height) * this.canvasSize - this.windowHalfY;
  // }

  @HostListener('window:resize', ['$event'])
  onWindowResize(): void {
    this.camera.aspect = this.canvasSize / this.canvasSize;
    this.camera.updateProjectionMatrix();
  }
}