import * as THREE from "three";
import {loadPDBFromId} from "./pdb_loader.js";

import * as CANNON from "../lib/cannon-es.js";

// 3 residue code (in pdb) to single letter type for Amino Acids
let codeMap = {
    "LYS": "K", "CYS": "C", "CYX": "C", "ALA": "A", "THR": "T", "GLU": "E",
    "GLN": "Q", "SER": "S", "ASP": "D", "ASN": "N", "HIS": "H", "HSD": "H",
    "GLY": "G", "PRO": "P", "ARG": "R", "VAL": "V", "ILE": "I", "LEU": "L",
    "MET": "M", "PHE": "F", "TYR": "Y", "TRP": "W"
};

class Atom {
    constructor(data, scale, origin) {
        this.atomType = data.atomType;
        this.position = new THREE.Vector3(
            data.x, data.y, data.z
        ).multiplyScalar(
            // Apply scale
            scale
        ).sub(
            // Use local coordinate system
            origin
        );
    }
}

class AminoAcid {
    constructor(data, strandId, scale, physicsWorld,
        physicsRadius=0.02, physicsMass=1
    ) {
        this.strandId = strandId;
        this.position = data.position.clone().multiplyScalar(scale);
        this.scale = scale;
        this.quaternion = new THREE.Quaternion();
        this.atoms = data.atoms.map(a=>new Atom(a, scale, this.position));

        this.type = codeMap[data.resType]

        // Add to physics world
        this.physicsShape = new CANNON.Sphere(physicsRadius);
        this.physicsBody = new CANNON.Body({
            mass: physicsMass,
        });
        this.physicsBody.addShape(this.physicsShape);
        this.physicsBody.position.copy(this.position);
        physicsWorld.addBody(this.physicsBody);
    }

    diffuse(magnitude=0.1) {
        // Apply impulse in random direction
        // Make things wiggle
        this.physicsBody.applyLocalImpulse(
            new THREE.Vector3().randomDirection().multiplyScalar(
                magnitude * this.scale
            ),
            new THREE.Vector3()
        );
    }

    update() {
        this.position.copy(this.physicsBody.position);
        this.quaternion.copy(this.physicsBody.quaternion);
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
                if (dist > 2 * this.scale) {
                    continue;
                }
                const spring = new CANNON.Spring(
                    e1.physicsBody,
                    e2.physicsBody,
                    {
                        localAnchorA: new CANNON.Vec3(0, 0, 0),
                        localAnchorB: new CANNON.Vec3(0, 0, 0),
                        restLength: dist,
                        stiffness: 1 * this.scale,
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