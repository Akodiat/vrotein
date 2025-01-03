import * as THREE from "three";
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

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
            for (const e of protein.aaGroups) {
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
            protein.getResidueCount()
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const matrix = new THREE.Matrix4();

        let i=0;
        for (const g of protein.aaGroups) {
            for (const e of g.aminoAcids) {
                matrix.setPosition(e.position);
                mesh.setMatrixAt(i, matrix);
                mesh.setColorAt(i, nucleosideColors[e.type]);
                i++;
            }
        }
        this.instancedMeshes.set(protein, mesh);
        this.container.add(mesh);
    }

    update() {
        const tempM = new THREE.Matrix4();
        const tempV = new THREE.Vector3();
        for (const protein of this.proteins) {
            const mesh = this.instancedMeshes.get(protein);
            let i=0;
            for (const g of protein.aaGroups) {
                g.update();
                for (const e of g.aminoAcids) {
                    tempV.copy(e.position);
                    tempV.applyQuaternion(g.quaternion);
                    tempV.add(g.position);

                    tempM.setPosition(tempV);
                    mesh.setMatrixAt(i, tempM);
                    i++;
                }
                g.diffuse();
            }
            mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

class AtomSphereView extends View {
    constructor(scene, scale, segments=6) {
        super(scene, scale);

        this.material = new THREE.MeshStandardMaterial();

        const radius = 0.1 * this.scale;
        this.geometry = new THREE.IcosahedronGeometry(
            radius, 1
        );

        this.instancedMeshes = new Map();

        this.tempV = new THREE.Vector3();
        this.tempM = new THREE.Matrix4();
        this.tempQ = new THREE.Quaternion();
    }

    addProtein(protein) {
        super.addProtein(protein);

        const mesh = new THREE.InstancedMesh(
            this.geometry,
            this.material,
            protein.getAtomCount()
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.tempM = new THREE.Matrix4();

        let iInst = 0;
        for (const g of protein.aaGroups) {
            for (const e of g.aminoAcids) {
                for (const atom of e.atoms) {
                    this.tempV.copy(atom.position);
                    this.tempV.add(e.position);
                    this.tempV.applyQuaternion(g.quaternion);
                    this.tempV.add(g.position);
                    this.tempM.setPosition(this.tempV);
                    mesh.setMatrixAt(iInst, this.tempM);
                    mesh.setColorAt(iInst, nucleosideColors[e.type]);
                    iInst++;
                }
            }
        }
        this.instancedMeshes.set(protein, mesh);
        this.container.add(mesh);
    }

    update() {
        this.tempM = new THREE.Matrix4();
        for (const protein of this.proteins) {
            const mesh = this.instancedMeshes.get(protein);
            let i = 0;
            for (const g of protein.aaGroups) {
                g.update();
                for (const e of g.aminoAcids) {
                    for (const atom of e.atoms) {
                        this.tempV.copy(atom.position);
                        this.tempV.add(e.position);
                        this.tempV.applyQuaternion(g.quaternion);
                        this.tempV.add(g.position);
                        this.tempM.setPosition(this.tempV);
                        mesh.setMatrixAt(i, this.tempM);
                        i++;
                    }
                }
                g.diffuse();
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
    constructor(scene, scale) {
        super(scene, scale);

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
        for (const e of protein.aaGroups) {
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
            for (const e of protein.aaGroups) {
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

class LineView extends View {
    constructor(scene, scale) {
        super(scene, scale);

        this.material = new LineMaterial( {
            worldUnits: true,
            linewidth: 0.12 * this.scale,
            vertexColors: true
        });

        this.lines = new Map();
    }

    addProtein(protein) {
        super.addProtein(protein);

        for (const strand of protein.strands) {
            const positions = [], colors = [];
            for (const g of strand) {
                for (const e of g.aminoAcids) {
                    positions.push(
                        e.position.x,
                        e.position.y,
                        e.position.z
                    );
                    const c = nucleosideColors[e.type];
                    colors.push(c.r, c.g, c.b)
                }
            }

            const geometry = new LineGeometry();
            geometry.setPositions(positions);
            geometry.setColors(colors);

            const line = new Line2(geometry, this.material);
            line.computeLineDistances();
            line.scale.set(1, 1, 1);
            this.container.add(line);
            this.lines.set(strand, line);
        }
    }

    update() {
        const tempV = new THREE.Vector3();
        for (const protein of this.proteins) {
            for (const strand of protein.strands) {
                const positions = [];
                for (const g of strand) {
                    g.update();
                    for (const e of g.aminoAcids) {
                        tempV.copy(e.position);
                        tempV.applyQuaternion(g.quaternion);
                        tempV.add(g.position);
                        positions.push(
                            tempV.x, tempV.y, tempV.z
                        );
                    }
                    g.diffuse();
                }
                const line = this.lines.get(strand);
                line.geometry.setPositions(positions);
                line.needsUpdate = true;
            }
        }
    }
}

class SplineView extends View {
    constructor(scene, scale) {
        super(scene, scale);

        this.material = new LineMaterial( {
            worldUnits: true,
            linewidth: 0.12 * this.scale,
            vertexColors: true
        });

        this.lines = new Map();
    }

    addProtein(protein) {
        super.addProtein(protein);

        const point = new THREE.Vector3();
        for (const strand of protein.strands) {

            const points = [];
            for (const g of strand) {
                for (const e of g.aminoAcids) {
                    points.push(g.position.clone().add(e.position));
                }
            }

            const spline = new THREE.CatmullRomCurve3(points);
            const divisions = Math.round(12 * points.length);
            const positions = [];
            const colors = [];
            let iElem = 0;

            const strandAAs = [];
            const strandAAOrigins = [];
            for (const g of strand) {
                for (const e of g.aminoAcids) {
                    strandAAs.push(e);
                    strandAAOrigins.push(g.position);
                }
            }
            const lStrand = strandAAs.length;
            for (let i=0; i<divisions; i++) {
                const t = i / divisions;
                spline.getPoint(t, point);
                positions.push(point.x, point.y, point.z);

                if (iElem+1<lStrand &&
                    point.distanceToSquared(
                        strandAAOrigins[iElem].clone().add(
                            strandAAs[iElem].position
                        )
                    ) >
                    point.distanceToSquared(
                        strandAAOrigins[iElem+1].clone().add(
                            strandAAs[iElem+1].position
                        )
                    )
                ) {
                    // If we are closer to the next element, advance
                    iElem++
                }
                const c = nucleosideColors[strandAAs[iElem].type];
                colors.push(c.r, c.g, c.b);
            }

            const geometry = new LineGeometry();
            geometry.setPositions(positions);
            geometry.setColors(colors);

            const line = new Line2(geometry, this.material);
            line.computeLineDistances();
            line.scale.set(1, 1, 1);
            this.container.add(line);
            this.lines.set(strand, line);
        }
    }

    update() {
        const point = new THREE.Vector3();
        for (const protein of this.proteins) {
            for (const strand of protein.strands) {
                const points = [];
                for (const g of strand) {
                    g.update();
                    for (const e of g.aminoAcids) {
                        const p = e.position.clone();
                        p.applyQuaternion(g.quaternion);
                        p.add(g.position);
                        points.push(p);
                    }
                    g.diffuse();
                }
                const spline = new THREE.CatmullRomCurve3(points);
                const divisions = Math.round(12 * points.length);
                const positions = [];
                for (let i=0, l=divisions; i<l; i++) {
                    const t = i / l;

                    spline.getPoint(t, point);
                    positions.push(point.x, point.y, point.z);
                }
                const line = this.lines.get(strand);
                line.geometry.setPositions(positions);
                line.needsUpdate = true;
            }
        }
    }
}

export {
    View,
    SphereView, AtomSphereView,
    MetaBallView,
    LineView, SplineView
}