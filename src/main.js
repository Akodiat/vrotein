import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { XRButton } from "three/addons/webxr/XRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";
import * as CANNON from "../lib/cannon-es.js";
import { loadLocal } from "./file.js";
import { loadPDBFromId } from "./pdb_loader.js"

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
let handModel1, handModel2;
let controller1, controller2;
let controllerGrip1, controllerGrip2;

// cannon.js variables
let world;

let aminoAcids = [];
let repulsiveSphere;
let bones1, bones2;

init();
animate();

function init() {

    world = new CANNON.World();

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
    scene.background = new THREE.Color(0x00000, 0);

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

    document.body.appendChild(XRButton.createButton(renderer, sessionInit));

    // controllers
    controller1 = renderer.xr.getController(0);
    scene.add(controller1);

    controller2 = renderer.xr.getController(1);
    scene.add(controller2);

    const controllerModelFactory = new XRControllerModelFactory();
    const handModelFactory = new XRHandModelFactory(null, model=>{
        model.boneSpheres = [];
        for (const bone of model.bones) {
            const b = new PhysicalSphere(
                0.012,
                new THREE.MeshStandardMaterial({color: 0xff0000}),
                1,
                new THREE.Vector3()
            );
            b.body.position.copy(bone.position);
            b.update();
            model.boneSpheres.push(b);
            scene.add(b.mesh);
            world.addBody(b.body);
        }
    });

    // Hand 1
    controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip1.add(
        controllerModelFactory.createControllerModel(controllerGrip1),
    );
    scene.add(controllerGrip1);

    hand1 = renderer.xr.getHand(0);
    handModel1 = handModelFactory.createHandModel(hand1, 'mesh'
    );
    hand1.add(handModel1);

    scene.add(hand1);

    // Hand 2
    controllerGrip2 = renderer.xr.getControllerGrip(1);
    controllerGrip2.add(
        controllerModelFactory.createControllerModel(controllerGrip2),
    );
    scene.add(controllerGrip2);

    hand2 = renderer.xr.getHand(1);
    handModel2 = handModelFactory.createHandModel(hand2, 'mesh', motionController=>{
        for (const bone of motionController.bones) {
            const b = new PhysicalSphere(
                0.012,
                new THREE.MeshStandardMaterial({color: 0xff0000}),
                1,
                new THREE.Vector3()
            );
            b.body.position.copy(bone.position);
            b.update();
            scene.add(b.mesh);
            world.addBody(b.body);
        }
    });
    hand2.add(handModel2);
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

    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
    });

    container = new THREE.Group();
    scene.add(container);


    const scale = 1/10;

    loadPDBFromId(
        "8p1a"
        //"8qql"
    ).then(systems=>{
        aminoAcids = [];
        for (const chain of systems) {
            for (const e of chain.residues) {
                const sphere = new PhysicalSphere(
                    0.02, material, 1,
                    e.position.clone().multiplyScalar(scale)
                );
                sphere.strandId = chain.id; // TODO: save in new class
                container.add(sphere.mesh);
                world.addBody(sphere.body);
                aminoAcids.push(sphere);
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
                if (dist > 0.2) {
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

    for (const model of [handModel1, handModel2]) {
        const mc = model.motionController;
        if (!mc || !mc.bones) {
            continue;
        }
        for (let i=0; i<mc.bones.length; i++) {
            const bone = mc.bones[i];
            const boneSphere = mc.boneSpheres[i];
            boneSphere.body.position.copy(bone.position);
            boneSphere.update();
        }
    }

    let com = new THREE.Vector3();
    for (const e of aminoAcids) {
        e.update();

        // "Diffusion"
        e.body.applyLocalImpulse(
            new THREE.Vector3().randomDirection().multiplyScalar(0.01),
            new THREE.Vector3()
        );

        com.add(e.mesh.position);
    }
    com.divideScalar(aminoAcids.length);

    controls.update();

    // Render three.js
    renderer.render(scene, camera);
}
