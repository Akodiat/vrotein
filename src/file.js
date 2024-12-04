import * as THREE from "three";
import { AminoAcidMonomer, Strand, System } from "./system.js";

async function loadLocal(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
    }
    const json = await response.json();
    return readFromJSON(json);
}

function readFromJSON(json_data) {
    const systems = [];
    for (const system of json_data.systems) {
        let sys;
        for (const strand of system.strands) {
            if (strand.class === "Peptide") {
                if (sys === undefined) {
                    sys = new System(json_data.box);
                    systems.push(sys);
                }
                const s = new Strand(sys, strand.id);
                strand.monomers.forEach((e) => {
                    let monomerClass;
                    switch (e.class) {
                        case "AA":
                            monomerClass = AminoAcidMonomer;
                            break;
                        default:
                            throw new Error(
                                `Unrecognised type of element:  ${e.class}`,
                            );
                    }

                    if (sys.elements.has(e.id)) {
                        throw "Differing id handling not inplemented yet";
                    }
                    const monomer = new monomerClass(
                        e.id,
                        e.type,
                        s,
                        new THREE.Vector3(...e.p),
                        new THREE.Vector3(...e.a1),
                        new THREE.Vector3(...e.a3),
                    );
                    s.monomers.push(monomer);
                });
                sys.strands.push(s);
            }
        }
    }
    return systems;
}

export { loadLocal };
