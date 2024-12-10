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
    constructor(scene, scale) {
        this.scale = scale;
        this.container = new THREE.Group();
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
    constructor(scene, scale, segments=8) {
        super(scene, scale);

        const radius = 0.25 * this.scale;

        this.sphereGeometry = new THREE.SphereGeometry(
            radius,
            segments,
            segments,
        );

        this.spheres = new Map();
    }

    addProtein(protein) {
        super.addProtein(protein);
        for (const e of protein.aminoAcids) {
            const material = new THREE.MeshStandardMaterial({
                color: nucleosideColors[e.type],
            });
            const mesh = new THREE.Mesh(
                this.sphereGeometry,
                material
            );
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.position.copy(e.position);
            this.spheres.set(e, mesh);
            this.container.add(mesh);
        }
    }

    update() {
        for (const protein of this.proteins) {
            for (const e of protein.aminoAcids) {
                e.update();
                this.spheres.get(e).position.copy(e.position);
                e.diffuse();
            }
        }
    }
}

class AtomSphereView extends View {
    constructor(scene, scale, segments=8) {
        super(scene, scale);

        const radius = 0.1 * this.scale;

        this.sphereGeometry = new THREE.SphereGeometry(
            radius,
            segments,
            segments,
        );
        this.sphereMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
        });

        this.spheres = new Map();
    }

    addProtein(protein) {
        super.addProtein(protein);
        for (const e of protein.aminoAcids) {
            const material = new THREE.MeshStandardMaterial({
                color: nucleosideColors[e.type],
            });
            const mesh = new THREE.Group();
            for (const atom of e.atoms) {
                const atomMesh = new THREE.Mesh(
                    this.sphereGeometry,
                    material
                );
                atomMesh.position.add(atom.position);
                atomMesh.position.sub(e.position);
                atomMesh.castShadow = true;
                atomMesh.receiveShadow = true;
                mesh.add(atomMesh);
            }
            mesh.position.copy(e.position);
            this.spheres.set(e, mesh);
            this.container.add(mesh);
        }
    }

    update() {
        for (const protein of this.proteins) {
            for (const e of protein.aminoAcids) {
                e.update();
                this.spheres.get(e).position.copy(e.position);
                this.spheres.get(e).quaternion.copy(e.quaternion);
                e.diffuse();
            }
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


class MetaCubeView extends View {
    constructor(scene, scale) {
        super(scene, scale);

        const material = new THREE.MeshStandardMaterial({
            // envMap: scene.environment,
            roughness: 0.1,
            metalness: 0.9,
            vertexColors: true
        });

        this.blob = new MarchingCubes(128, material, false, true, 500000);
        this.container.add(this.blob);

        this.strength = 0.17 * this.scale // this.scalingFactor;
        this.subtract = 200 * this.scale  /// this.scalingFactor;
    }

    addProtein(protein) {
        super.addProtein(protein);
        for (const e of protein.aminoAcids) {
            const p = transformPoint(e.position);
            this.blob.addBall(
                p.x,
                p.y,
                p.z,
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
                    p.x,
                    p.y,
                    p.z,
                    this.strength, this.subtract,
                    nucleosideColors[e.type]
                );
                e.diffuse();
            }
        }
        this.blob.update();
    }
}

export {View, SphereView, AtomSphereView, MetaCubeView}