import * as THREE from "three";
import { monomerGeometry, monomerMaterial, strandColors } from "./constants.js";

class System {
    constructor(box) {
        this.box = box;
        this.strands = [];
        this.elements = new Map();
        this.idCounter = 0;
    }

    getSize() {
        return this.elements.size;
    }

    getCenterOfMass() {
        const v = new THREE.Vector3();
        for (const m of this.elements.values()) {
            v.add(m.position);
        }
        return v.divideScalar(this.getSize());
    }
}

class Strand {
    constructor(system, id) {
        this.system = system;
        this.id = id;
        this.monomers = [];
    }
}

class Monomer {
    constructor(id, type, strand, position, a1, a3) {
        this.id = id;
        this.type = type;
        this.strand = strand;
        this.position = position;
        this.targetPosition = position;
        this.a1 = a1;
        this.a3 = a3;
        this.a2 = a1.clone().cross(a3);
        this.strand.system.elements.set(this.id, this);
        this.strand.system.idCounter = Math.max(
            this.strand.system.idCounter,
            this.id,
        );
    }

    getBackbonePos(v = new THREE.Vector3()) {
        return this._calcBackbonePos("position", v);
    }

    getTargetBackbonePos(v = new THREE.Vector3()) {
        return this._calcBackbonePos("targetPosition", v);
    }

    _calcBackbonePos() {
        throw "Abstract method _calcBackbonePos() not implemented";
    }
}

class DNAMonomer extends Monomer {
    _calcBackbonePos(p = "position", v = new THREE.Vector3()) {
        v.set(
            this[p].x - (0.34 * this.a1.x + 0.3408 * this.a2.x),
            this[p].y - (0.34 * this.a1.y + 0.3408 * this.a2.y),
            this[p].z - (0.34 * this.a1.z + 0.3408 * this.a2.z),
        );
        return v;
    }

    getCategory() {
        return "DNA";
    }
}

class RNAMonomer extends Monomer {
    _calcBackbonePos(p = "position", v = new THREE.Vector3()) {
        v.set(
            this[p].x - (0.4 * this.a1.x + 0.2 * this.a2.x),
            this[p].y - (0.4 * this.a1.y + 0.2 * this.a2.y),
            this[p].z - (0.4 * this.a1.z + 0.2 * this.a2.z),
        );
        return v;
    }
    getCategory() {
        return "RNA";
    }
}

class AminoAcidMonomer extends Monomer {
    _calcBackbonePos(p = "position", v = new THREE.Vector3()) {
        v.copy(this[p]);
        return v;
    }

    getCategory() {
        return "AA";
    }
}

export { System, Strand, DNAMonomer, RNAMonomer, AminoAcidMonomer };
