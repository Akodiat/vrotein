import * as THREE from "three";
import {loadPDBFromId} from "./pdb_loader.js";

import * as CANNON from "../lib/cannon-es.js";

class Atom {
    constructor(data, scale) {
        this.atomType = data.atomType;
        this.position = new THREE.Vector3(
            data.x, data.y, data.z
        ).multiplyScalar(scale);
    }
}

class AminoAcid {
    constructor(data, strandId, scale, physicsWorld,
        physicsRadius=0.02, physicsMass=1
    ) {
        this.strandId = strandId;
        this.position = data.position.clone().multiplyScalar(scale);
        this.quaternion = new THREE.Quaternion();
        this.atoms = data.atoms.map(a=>new Atom(a, scale));

        // Add to physics world
        this.physicsShape = new CANNON.Sphere(physicsRadius);
        this.physicsBody = new CANNON.Body({
            mass: physicsMass,
        });
        this.physicsBody.addShape(this.physicsShape);
        this.physicsBody.position.copy(this.position);
        physicsWorld.addBody(this.physicsBody);
    }

    diffuse(magnitude=0.01) {
        // Apply impulse in random direction
        // Make things wiggle
        this.physicsBody.applyLocalImpulse(
            new THREE.Vector3().randomDirection().multiplyScalar(magnitude),
            new THREE.Vector3()
        );
    }

    update() {
        this.position.copy(this.physicsBody.position);
    }
}

class Protein {
    constructor(id="8p1a", physicsWorld, scale) {
        this.id = id; 
        //"8qql"
        this.physicsWorld = physicsWorld;
        this.scale = scale;
    }
    init(callback) {
        loadPDBFromId(this.id).then(systems=>{
            this.aminoAcids = [];
            this.strands = [];
            for (const chain of systems) {
                const strand = [];
                for (const e of chain.residues) {
                    const aminoAcid = new AminoAcid(
                        e, chain.id, this.scale, this.physicsWorld
                    );
                    this.aminoAcids.push(aminoAcid);
                    strand.push(aminoAcid);
                }
                this.strands.push(strand);
            }

            this.initSpringNetwork();
            callback.bind(this)();
        });
    }
    initSpringNetwork() {
        for (let i = 0; i < this.aminoAcids.length; i++) {
            for (let j = 0; j < this.aminoAcids.length; j++) {
                if (j <= i) {
                    continue;
                }
                const e1 = this.aminoAcids[i];
                const e2 = this.aminoAcids[j];
                if (e1.strandId !== e2.strandId) {
                    continue;
                }
                const dist = e1.position.distanceTo(e2.position);
                if (dist > 0.2) {
                    continue;
                }
                const spring = new CANNON.Spring(
                    e1.physicsBody,
                    e2.physicsBody, 
                    {
                        localAnchorA: new CANNON.Vec3(0, 0, 0),
                        localAnchorB: new CANNON.Vec3(0, 0, 0),
                        restLength: dist,
                        stiffness: 10,
                        damping: 0.0
                    }
                );

                // Compute the force after each step
                this.physicsWorld.addEventListener("postStep", () => {
                    spring.applyForce();
                });
            }
        }
    }
}

export {Protein}