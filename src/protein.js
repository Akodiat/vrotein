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
    constructor(data, scale, origin) {
        this.position = data.position.clone().multiplyScalar(
            scale
        ).sub(
            origin
        );
        this.atoms = data.atoms.map(a=>new Atom(a, scale,
            data.position.clone().multiplyScalar(scale)
        ));
        this.type = codeMap[data.resType];
    }
}

class AAGroup {
    constructor(aaData, strandId, scale, proteinPos, physicsWorld, physicsMass=1
    ) {
        this.strandId = strandId;
        this.aminoAcids = [];

        // Calculate group centre of mass
        this.position = new THREE.Vector3();
        aaData.forEach(data=>this.position.add(data.position.clone().multiplyScalar(
            scale
        )));
        this.position.divideScalar(aaData.length);

        for (const data of aaData) {
            const e = new AminoAcid(data, scale, this.position);
            this.aminoAcids.push(e);
        }

        this.position.add(proteinPos);

        this.scale = scale;
        this.quaternion = new THREE.Quaternion();

        // Add to physics world
        this.physicsShape = new CANNON.Sphere(
            0.2 * scale // * aaData.length
        );
        this.physicsBody = new CANNON.Body({
            mass: aaData.length * physicsMass,
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
    constructor(id="8p1a", physicsWorld, scale, position, physicsResolution=1) {
        this.id = id;
        //"8qql"
        this.physicsWorld = physicsWorld;
        this.scale = scale;
        this.position = position;
        this.physicsResolution = physicsResolution;
    }
    init(callback) {
        loadPDBFromId(this.id).then(systems=>{
            this.aaGroups = [];
            this.strands = [];
            for (const chain of systems) {
                const strand = [];
                let elements = [];
                for (let i=0, l=chain.residues.length; i<l; i++) {
                    elements.push(chain.residues[i]);
                    // Group up to "physicsResolution" amino acids
                    // together in physics world.
                    if (i % this.physicsResolution === 0) {
                        const aaGroup = new AAGroup(
                            elements, chain.id, this.scale, this.position,
                            this.physicsWorld
                        );
                        this.aaGroups.push(aaGroup);
                        strand.push(aaGroup);
                        elements = [];
                    }
                }
                this.strands.push(strand);
            }

            this.initSpringNetwork();
            callback.bind(this)();
        });
    }

    getResidueCount() {
        let sum = 0;
        this.aaGroups.forEach(g => sum += g.aminoAcids.length);
        return sum;
    }

    getAtomCount() {
        let sum = 0;
        this.aaGroups.forEach(
            g => g.aminoAcids.forEach(
                a => sum += a.atoms.length
            )
        );
        return sum;
    }

    initSpringNetwork() {
        for (let i = 0; i < this.aaGroups.length; i++) {
            for (let j = 0; j < this.aaGroups.length; j++) {
                if (j <= i) {
                    continue;
                }
                const e1 = this.aaGroups[i];
                const e2 = this.aaGroups[j];
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
                        stiffness: 10 * this.scale,
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