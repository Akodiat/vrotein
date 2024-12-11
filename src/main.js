import * as THREE from "three";
import * as CANNON from "../lib/cannon-es.js";
import GUI from "../lib/lil-gui.esm.min.js";

import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { XRButton } from "three/addons/webxr/XRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";
import {XREstimatedLight} from "three/addons/webxr/XREstimatedLight.js";

import { SphereView, AtomSphereView, MetaBallView } from "./view.js"
import { Protein } from "./protein.js";
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

    // Place closer to eye level
    const spawnPoint = new THREE.Vector3(0, 1.5, 0);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.01,
        100,
    );
    camera.position.z = 1;
    camera.position.y = spawnPoint.y;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00000, 0);

    const axesHelper = new THREE.AxesHelper(0.5); scene.add(axesHelper);
    scene.add(axesHelper);

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
    light.castShadow = true;
    light.shadow.camera.top = 2;
    light.shadow.camera.bottom = -2;
    light.shadow.camera.right = 2;
    light.shadow.camera.left = -2;
    light.shadow.mapSize.set(2048, 2048);

    let defaultLight = new THREE.Group();
    defaultLight.add(hemilight);
    defaultLight.add(light);
    scene.add(defaultLight);

    // Don't add the XREstimatedLight to the scene initially.
    // It doesn't have any estimated lighting values until an AR session starts.
    const xrLight = new XREstimatedLight(renderer);
    xrLight.addEventListener("estimationstart", () => {
        // Swap the default light out for the estimated one one we start
        // getting some estimated values.
        scene.add(xrLight);
        scene.remove(defaultLight);

        // The estimated lighting also provides an environment cubemap, which
        // we can apply here.
        if (xrLight.environment) {
            scene.environment = xrLight.environment;
        }
    });

    xrLight.addEventListener("estimationend", () => {
        // Swap the lights back when we stop receiving estimated values.
        scene.add(defaultLight);
        scene.remove(xrLight);
    });

    window.addEventListener("resize", onWindowResize);

    controls = new TrackballControls(camera, renderer.domElement);
    controls.target.copy(spawnPoint);

    const scale = 1/30;

    const gui = new GUI();

    const guiParams = {
        view: "Residue spheres",
        clear: ()=>{
            scene.remove(view.container);
            view = new view.constructor(scene, scale);
        },
        pdbId: "8p1a",
        load: ()=>{
            const protein = new Protein(
                guiParams.pdbId,
                world,
                scale,
                spawnPoint
            );
            protein.init(()=>view.addProtein(protein));
        }
    };

    gui.add(guiParams, "view", [
        "Residue spheres",
        "Atom spheres",
        "Residue meta balls"
    ]).name("View")
	.onChange(v => {
        let viewType;
		switch (v) {
            case "Residue spheres":
                viewType = SphereView;
                break;
            case "Atom spheres":
                viewType = AtomSphereView;
                break;
            case "Residue meta balls":
                viewType = MetaBallView;
                break;
        }
        const oldView = view;
        scene.remove(oldView.container);
        view = new viewType(scene, scale);
        view.copy(oldView);
	});

    gui.add(guiParams, "pdbId").name("PDB ID");
    gui.add(guiParams, "load").name("Load");
    gui.add(guiParams, "clear").name("Clear");


    const folder = gui.addFolder("Examples");
    for (const example of [
        "8qql","8p1a", "8p1b", "8p1c", "8p1d"
    ]) {
        guiParams["load"+example] = ()=>{
            const protein = new Protein(
                example, world, scale, spawnPoint
            );
            protein.init(()=>view.addProtein(protein));
        }
        folder.add(guiParams, "load"+example);
    }

    view = new SphereView(scene, scale);
    const protein = new Protein(
        "8p1a", world, scale, spawnPoint
    );
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
