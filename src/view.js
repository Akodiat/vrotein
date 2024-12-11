import * as THREE from "three";
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

const nucleosideColors = {
    "K": new THREE.Color(0x4747B8), //Royal Blue
    "C": new THREE.Color(0xFFFF33), //Medium Yellow
    "A": new THREE.Color(0x8CFF8C), //Medium green
    "T": new THREE.Color(0xFF3333), //Red
    "E": new THREE.Color(0x660000), //Dark Brown
    "S": new THREE.Color(0xFF7042), //Medium Orange
    "D": new THREE.Color(0xA00042), //Dark Rose
    "N": new THREE.Color(0xFF7C70), //Light Salmon
    "Q": new THREE.Color(0xFF4C4C), //Dark Salmon
    "H": new THREE.Color(0x7070FF), //Medium Blue
    "G": new THREE.Color(0xEBEBEB), //Light Grey
    "P": new THREE.Color(0x525252), //Dark Grey
    "R": new THREE.Color(0x00007C), //Dark Blue
    "V": new THREE.Color(0x5E005E), //Dark Purple
    "I": new THREE.Color(0x004C00), //Dark Green
    "L": new THREE.Color(0x455E45), //Olive Green
    "M": new THREE.Color(0xB8A042), //Light Brown
    "F": new THREE.Color(0x534C42), //Olive Grey
    "Y": new THREE.Color(0x8C704C), //Medium Brown
    "W": new THREE.Color(0x4F4600), //Olive Brown
};

class View {
    constructor(scene, scale, spawnPoint) {
        this.scale = scale;
        this.container = new THREE.Group();

        this.container.position.copy(spawnPoint);

        scene.add(this.container);
        this.proteins = [];
    }

    addProtein(protein) {
        this.proteins.push(protein);
    }

    update() {
        for (const protein of this.proteins) {
            for (const e of protein.aminoAcids) {
                e.update();
            }
        }
    }

    copy(view) {
        this.proteins = [];
        for (const protein of view.proteins) {
            this.addProtein(protein);
        }
    }
}

class SphereView extends View {
    constructor(scene, scale, spawnPoint, segments=8) {
        super(scene, scale, spawnPoint);


        this.material = new THREE.MeshStandardMaterial();

        const radius = 0.2 * this.scale;
        this.geometry = new THREE.SphereGeometry(
            radius,
            segments,
            segments,
        );

        this.instancedMeshes = new Map();
    }

    addProtein(protein) {
        super.addProtein(protein);

        const mesh = new THREE.InstancedMesh(
            this.geometry,
            this.material,
            protein.aminoAcids.length
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const matrix = new THREE.Matrix4();

        for (let i=0; i<protein.aminoAcids.length; i++) {
            const e = protein.aminoAcids[i];
            matrix.setPosition(e.position);

            mesh.setMatrixAt(i, matrix);
            mesh.setColorAt(i, nucleosideColors[e.type]);
        }
        this.instancedMeshes.set(protein, mesh);
        this.container.add(mesh);
    }

    update() {
        const matrix = new THREE.Matrix4();
        for (const protein of this.proteins) {
            const mesh = this.instancedMeshes.get(protein);
            for (let i=0; i<protein.aminoAcids.length; i++) {
                const e = protein.aminoAcids[i];
                e.update();
                matrix.setPosition(e.position);
                mesh.setMatrixAt(i, matrix);
                e.diffuse();
            }
            mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

class AtomSphereView extends View {
    constructor(scene, scale, spawnPoint, segments=6) {
        super(scene, scale, spawnPoint);

        this.material = new THREE.MeshStandardMaterial();

        const radius = 0.1 * this.scale;
        this.geometry = new THREE.SphereGeometry(
            radius,
            segments,
            segments,
        );

        this.instancedMeshes = new Map();

        this.tempV = new THREE.Vector3();
        this.tempM = new THREE.Matrix4();
        this.tempQ = new THREE.Quaternion();
    }

    addProtein(protein) {
        super.addProtein(protein);

        // Count the atoms
        const count = protein.aminoAcids.map(
            e=>e.atoms.length
        ).reduce((s, v) => s + v, 0);

        const mesh = new THREE.InstancedMesh(
            this.geometry,
            this.material,
            count
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.tempM = new THREE.Matrix4();

        let iInst = 0;
        for (let i=0; i<protein.aminoAcids.length; i++) {
            const e = protein.aminoAcids[i];
            for (const atom of e.atoms) {
                this.tempV.copy(atom.position);
                //this.tempV.applyQuaternion(e.quaternion);
                this.tempV.add(e.position);
                this.tempM.setPosition(this.tempV);
                mesh.setMatrixAt(iInst, this.tempM);
                mesh.setColorAt(iInst, nucleosideColors[e.type]);
                iInst++;
            }
        }
        console.log(protein.aminoAcids.length);
        this.instancedMeshes.set(protein, mesh);
        this.container.add(mesh);
    }

    update() {
        this.tempM = new THREE.Matrix4();
        for (const protein of this.proteins) {
            const mesh = this.instancedMeshes.get(protein);
            let iInst = 0;
            for (let i=0; i<protein.aminoAcids.length; i++) {
                const e = protein.aminoAcids[i];
                e.update();
                for (const atom of e.atoms) {
                    this.tempV.copy(atom.position);
                    this.tempV.applyQuaternion(e.quaternion);
                    this.tempV.add(e.position);
                    this.tempM.setPosition(this.tempV);
                    mesh.setMatrixAt(iInst, this.tempM);
                    iInst++;
                }
                e.diffuse();
            }
            mesh.instanceMatrix.needsUpdate = true;
        }
    }
}


function transformPoint(vector) {
    const v2 = vector.clone();
    v2.x = ( v2.x + 1.0 ) / 2.0;
    v2.y = ( v2.y + 1.0) / 2.0;
    v2.z = ( v2.z + 1.0 ) / 2.0;
    return v2
}


class MetaBallView extends View {
    constructor(scene, scale, spawnPoint) {
        super(scene, scale, spawnPoint);

        const material = new THREE.MeshStandardMaterial({
            // envMap: scene.environment,
            roughness: 0.1,
            metalness: 0.8,
            vertexColors: true
        });

        this.localScale = 0.7;
        this.blob = new MarchingCubes(64, material, false, true, 50000);
        this.blob.scale.multiplyScalar(this.localScale);
        this.blob.position.sub(new THREE.Vector3(1,1,1));
        this.blob.position.add(this.blob.scale);
        this.container.add(this.blob);

        this.strength = 0.35 * this.scale;
        this.subtract = 500 * this.scale;
    }

    addProtein(protein) {
        super.addProtein(protein);
        for (const e of protein.aminoAcids) {
            const p = transformPoint(e.position);
            this.blob.addBall(
                p.x / this.localScale,
                p.y / this.localScale,
                p.z / this.localScale,
                this.strength, this.subtract,
                nucleosideColors[e.type]
            );
        }
    }

    update() {
        this.blob.reset();
        for (const protein of this.proteins) {
            for (const e of protein.aminoAcids) {
                e.update();
                const p = transformPoint(e.position);
                this.blob.addBall(
                    p.x / this.localScale,
                    p.y / this.localScale,
                    p.z / this.localScale,
                    this.strength, this.subtract,
                    nucleosideColors[e.type]
                );
                e.diffuse();
            }
        }
        this.blob.update();
    }
}

export {View, SphereView, AtomSphereView, MetaBallView}