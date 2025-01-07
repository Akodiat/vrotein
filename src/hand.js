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
        //scene.add(mesh);

        const shape = new CANNON.Sphere(radius);
        const body = new CANNON.Body({
            mass: mass,
        });
        bone.physicsBody = body;
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
    constructor(index, renderer, handModelFactory, controllerModelFactory, scene) {

        // Hand
        this.hand = renderer.xr.getHand(index);
        this.physicalBones = [];
        this.handModel = handModelFactory.createHandModel(this.hand, 'mesh');
        this.hand.add(this.handModel);
        scene.add(this.hand);

        this.hand.addEventListener('pinchstart', event => {
            const controller = event.target;
            const indexTip = controller.joints['index-finger-tip'];
            const nearby = collideObject(indexTip, this.view.proteins);

            if (nearby.length > 0) {
                const shape = new CANNON.Sphere(0.015);
                // TODO: use one of physicalBones instead?
                // This is for the pitch drag
                this.physicsBody = new CANNON.Body({
                    mass: 1,
                });
                this.physicsBody.addShape(shape);
                this.physicsBody.position = indexTip.position;

                this.springForces = [];
                for (const body of nearby) {
                    this.springForces.push(new CANNON.Spring(
                        body, this.physicsBody,
                        {
                            localAnchorA: new CANNON.Vec3(0, 0, 0),
                            localAnchorB: new CANNON.Vec3(0, 0, 0),
                            restLength: body.position.distanceTo(this.physicsBody.position),
                            stiffness: 100,
                            damping: 50
                        }
                    ));
                }

                // Compute the force after each step
                this.view.proteins[0].physicsWorld.addEventListener("postStep", () => {
                    for (const f of this.springForces) {
                        f.applyForce();
                    }
                });
            }
        } );
        this.hand.addEventListener('pinchend', event => {
            if (this.physicsBody) {
                this.view.proteins[0].physicsWorld.removeBody(this.physicsBody);
                this.physicsBody = undefined;
                this.springForces = [];
            }
        });


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

function collideObject(indexTip, proteins) {
    const tmpVector1 = new THREE.Vector3();
    const nearby = [];
    for (const protein of proteins) {
        for (const aaGroup of protein.aaGroups) {
            const distance = indexTip.getWorldPosition(tmpVector1).distanceTo(aaGroup.physicsBody.position);
            if (distance < protein.AAPhysicsShape.boundingSphereRadius * 10) {
                nearby.push(aaGroup.physicsBody);
            }
        }
    }

    return nearby;
}

export {HandHandler, populateHand}