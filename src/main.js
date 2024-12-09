import * as THREE from "three";
import * as CANNON from "../lib/cannon-es.js";

import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { XRButton } from "three/addons/webxr/XRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";
 
import { SphereView, AtomSphereView } from "./view.js"
import { Protein } from "./Protein.js";
import { HandHandler, populateHand } from "./hand.js";

let view;

// three.js variables
let camera, scene, renderer, controls;
let container;

let handHandlers = [];

// cannon.js variables
let world;


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

    const controllerModelFactory = new XRControllerModelFactory();
    const handModelFactory = new XRHandModelFactory(
        null, model=>populateHand(model, scene, world)
    );
    handHandlers.push(new HandHandler(0, renderer, handModelFactory, controllerModelFactory, scene, world));
    handHandlers.push(new HandHandler(1, renderer, handModelFactory, controllerModelFactory, scene, world));

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

    container = new THREE.Group();
    scene.add(container);

    view = new SphereView(scene);
    const scale = 1/10;
    const protein = new Protein("8p1a", world, scale);
    protein.init(()=>{
        view.addProtein(protein);
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

    // Update hands
    for (const handHandler of handHandlers) {
        handHandler.update();
    }

    view.update();

    controls.update();

    // Render three.js
    renderer.render(scene, camera);
}
