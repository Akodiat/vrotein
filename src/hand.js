import * as THREE from "three";
import * as CANNON from "../lib/cannon-es.js";

function populateHand(model, scene, world) {
    const radius = 0.015;
    const material = new THREE.MeshStandardMaterial({color: 0xff0000});
    const mass = 10;
    const sphereGeometry = new THREE.IcosahedronGeometry(
        radius,
        1
    );

    model.physicalBones = [];
    for (const bone of model.bones) {
        const mesh = new THREE.Mesh(sphereGeometry, material);
        mesh.position.copy(bone.position);
        scene.add(mesh);

        const shape = new CANNON.Sphere(radius);
        const body = new CANNON.Body({
            mass: mass,
        });
        body.addShape(shape);
        body.position.copy(bone.position);
        world.addBody(body);

        model.physicalBones.push({
            mesh: mesh,
            body: body
        });
    }
}

class HandHandler {
    constructor(index, renderer, handModelFactory, controllerModelFactory, scene, world) {

        // Hand
        this.hand = renderer.xr.getHand(index);
        this.physicalBones = [];
        this.handModel = handModelFactory.createHandModel(this.hand, 'mesh');
        this.hand.add(this.handModel);
        scene.add(this.hand);

        // Controller
        this.controller = renderer.xr.getController(index);
        this.controllerGrip = renderer.xr.getControllerGrip(index);
        this.controllerGrip.add(
            controllerModelFactory.createControllerModel(this.controllerGrip),
        );
        scene.add(this.controllerGrip);

        /*
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1),
        ]);

        const line = new THREE.Line(geometry);
        line.name = "line";
        line.scale.z = 5;

        this.controller.add(line.clone());
        */
        scene.add(this.controller);
    }

    update() {
        const mc = this.handModel.motionController;
        if (!mc || !mc.physicalBones ) {
            return;
        }
        for (let i=0; i<mc.physicalBones.length; i++) {
            const bone = mc.bones[i];
            const boneSphere = mc.physicalBones[i];
            boneSphere.body.position.copy(bone.position);
            boneSphere.mesh.position.copy(bone.position);
        }
    }
}

export {HandHandler, populateHand}