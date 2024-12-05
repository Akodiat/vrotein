import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";
import * as CANNON from "../lib/cannon-es.js";
import { loadLocal } from "./file.js";

class PhysicalMesh {
    constructor(mesh, body, position = new THREE.Vector3()) {
        this.mesh = mesh;
        this.body = body;

        this.mesh.position.copy(position);
        this.body.position.copy(position);
    }

    /**
     * Copy coordinates from cannon.js to three.js
     */
    update() {
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);
    }
}

class PhysicalSphere extends PhysicalMesh {
    constructor(
        radius,
        material,
        mass = 0,
        position = new THREE.Vector3(),
        segments = 8,
    ) {
        const sphereGeometry = new THREE.SphereGeometry(
            radius,
            segments,
            segments,
        );
        const mesh = new THREE.Mesh(sphereGeometry, material);

        const shape = new CANNON.Sphere(radius);
        const body = new CANNON.Body({
            mass: mass,
        });
        body.addShape(shape);

        super(mesh, body, position);
    }
}

// three.js variables
let camera, scene, renderer, controls;
let container;
let hand1, hand2;
let controller1, controller2;
let controllerGrip1, controllerGrip2;

// cannon.js variables
let world;

let aminoAcids = [];
let repulsiveSphere;

init();
animate();

function init() {
    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.01,
        100,
    );
    camera.position.z = 1;

    // Scene
    scene = new THREE.Scene();

    // Renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.shadowMap.enabled = true;
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    const sessionInit = {
        requiredFeatures: ["hand-tracking"],
    };

    document.body.appendChild(VRButton.createButton(renderer, sessionInit));

    // controllers
    controller1 = renderer.xr.getController(0);
    scene.add(controller1);

    controller2 = renderer.xr.getController(1);
    scene.add(controller2);

    const controllerModelFactory = new XRControllerModelFactory();
    const handModelFactory = new XRHandModelFactory();

    // Hand 1
    controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip1.add(
        controllerModelFactory.createControllerModel(controllerGrip1),
    );
    scene.add(controllerGrip1);

    hand1 = renderer.xr.getHand(0);
    hand1.add(handModelFactory.createHandModel(hand1));

    scene.add(hand1);

    // Hand 2
    controllerGrip2 = renderer.xr.getControllerGrip(1);
    controllerGrip2.add(
        controllerModelFactory.createControllerModel(controllerGrip2),
    );
    scene.add(controllerGrip2);

    hand2 = renderer.xr.getHand(1);
    hand2.add(handModelFactory.createHandModel(hand2));
    scene.add(hand2);

    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
    ]);

    const line = new THREE.Line(geometry);
    line.name = "line";
    line.scale.z = 5;

    controller1.add(line.clone());
    controller2.add(line.clone());

    // Lights
    let hemilight = new THREE.HemisphereLight(0x808080, 0x606060);
    hemilight.intensity = 5;
    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 6, 0);
    light.intensity = 6;
    let defaultLight = new THREE.Group();
    defaultLight.add(hemilight);
    defaultLight.add(light);
    scene.add(defaultLight);

    window.addEventListener("resize", onWindowResize);

    controls = new TrackballControls(camera, renderer.domElement);

    world = new CANNON.World();

    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
    });

    container = new THREE.Group();
    container.scale.divideScalar(10)
    scene.add(container);

    loadLocal("resources/8p1a.oxview").then((systems) => {
        aminoAcids = [];
        for (const system of systems) {
            for (const strand of system.strands) {
                for (const e of strand.monomers) {
                    const sphere = new PhysicalSphere(
                        0.25, material, 1, e.position
                    );
                    sphere.strandId = strand.id; // TODO: save in new class
                    container.add(sphere.mesh);
                    world.addBody(sphere.body);
                    aminoAcids.push(sphere);
                }
            }
        }
        for (let i = 0; i < aminoAcids.length; i++) {
            for (let j = 0; j < aminoAcids.length; j++) {
                if (j <= i) {
                    continue;
                }
                const e1 = aminoAcids[i];
                const e2 = aminoAcids[j];
                if (e1.strandId !== e2.strandId) {
                    continue;
                }
                const dist = e1.mesh.position.distanceTo(e2.mesh.position);
                if (dist > 2) {
                    continue;
                }
                const spring = new CANNON.Spring(e1.body, e2.body, {
                    localAnchorA: new CANNON.Vec3(0, 0, 0),
                    localAnchorB: new CANNON.Vec3(0, 0, 0),
                    restLength: dist,
                    stiffness: 10,
                    damping: 0.0
                });

                // Compute the force after each step
                world.addEventListener("postStep", () => {
                    spring.applyForce();
                });
            }
        }
    });

    const redMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
    });
    repulsiveSphere = new PhysicalSphere(1, redMaterial, 1, new THREE.Vector3());
    container.add(repulsiveSphere.mesh);
    world.addBody(repulsiveSphere.body);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(animate);

    // Step the physics world
    world.fixedStep();

    let com = new THREE.Vector3();
    for (const e of aminoAcids) {
        e.update();

        com.add(e.mesh.position);
    }
    com.divideScalar(aminoAcids.length);

    repulsiveSphere.body.position.copy(com);
    repulsiveSphere.body.position.x += Math.sin(performance.now() / 2000) * 5;
    repulsiveSphere.update();

    controls.update();

    // Render three.js
    renderer.render(scene, camera);
}
