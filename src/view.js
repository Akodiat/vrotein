import * as THREE from "three";

class View {
    constructor(scene) {
        this.scene = scene;
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
}

class SphereView extends View {
    constructor(scene, radius, segments) {
        super(scene);

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
            const mesh = new THREE.Mesh(
                this.sphereGeometry,
                this.sphereMaterial
            );
            mesh.position.copy(e.position);
            this.spheres.set(e, mesh);
            this.scene.add(mesh);
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

export {View, SphereView}