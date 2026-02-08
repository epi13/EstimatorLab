export function attachCsiBuiltins(baseFns, {
  defFn,
  add,
}){
  function fieldInfo(value){
    return { value, note: "", raw: "" };
  }

  function requireAssy(value, label){
    if (!value || typeof value !== "object" || !value.__assy) throw new Error(`${label} expects an assembly`);
    return value;
  }

  function requireLine(value, label){
    const a = requireAssy(value, label);
    if (!a.__line) throw new Error(`${label} expects a line assembly`);
    return a;
  }

  function asString(value){
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "";
    return String(value);
  }

  function digitsOnly(value){
    return asString(value).replace(/[^0-9]/g, "");
  }

  function csiNorm(code){
    const d = digitsOnly(code);
    if (d.length > 6){
      const a = d.slice(0, 2);
      const b = d.slice(2, 4);
      const c = d.slice(4, 6);
      const tail = d.slice(6);
      return `${a} ${b} ${c}.${tail}`;
    }
    if (d.length === 6){
      const a = d.slice(0, 2);
      const b = d.slice(2, 4);
      const c = d.slice(4, 6);
      return `${a} ${b} ${c}`;
    }
    if (d.length >= 4){
      const a = d.slice(0, 2);
      const b = d.slice(2, 4);
      return `${a} ${b}`;
    }
    if (d.length >= 2){
      return d.slice(0, 2);
    }
    return asString(code).trim();
  }

  function csiDiv(code){
    const d = digitsOnly(code);
    if (d.length >= 2) return d.slice(0, 2);
    return "";
  }

  function csiSection(code){
    const d = digitsOnly(code);
    if (d.length >= 4) return `${d.slice(0, 2)} ${d.slice(2, 4)}`;
    if (d.length >= 2) return d.slice(0, 2);
    return "";
  }

  function csiItem(code){
    const d = digitsOnly(code);
    if (d.length > 6) return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)}.${d.slice(6)}`;
    if (d.length === 6) return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)}`;
    return csiNorm(code);
  }

  function csiParentCode(code){
    const d = digitsOnly(code);
    if (d.length > 6) return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)}`;
    if (d.length === 6) return `${d.slice(0, 2)} ${d.slice(2, 4)}`;
    if (d.length >= 4) return d.slice(0, 2);
    return "";
  }

  function csiKind(code){
    const d = digitsOnly(code);
    if (d.length > 6) return "subitem";
    if (d.length === 6) return "item";
    if (d.length >= 4) return "section";
    if (d.length >= 2) return "division";
    return "unknown";
  }

  function makeNode(code, title, children = null, flags = null){
    return {
      code,
      title,
      kind: csiKind(code),
      parent: csiParentCode(code),
      children: Array.isArray(children) ? children.slice() : [],
      reserved: Boolean(flags && flags.reserved),
      note: (flags && typeof flags.note === "string") ? flags.note : "",
    };
  }

  const CSI_MASTERFORMAT = (() => {
    const m = Object.create(null);
    const put = (node) => { m[csiNorm(node.code)] = node; };

    // Divisions 00-49 (publicly-available outline; reserved divisions noted)
    put(makeNode("00", "Procurement and Contracting Requirements", [
      "00 10", "00 20", "00 30", "00 40", "00 50", "00 60", "00 62", "00 63", "00 65", "00 72", "00 73", "00 90",
    ]));
    put(makeNode("00 10", "Solicitation", ["00 10 00"]));
    put(makeNode("00 10 00", "Solicitation"));
    put(makeNode("00 20", "Instructions for Procurement", ["00 20 00"]));
    put(makeNode("00 20 00", "Instructions for Procurement"));
    put(makeNode("00 30", "Available Information", ["00 30 00"]));
    put(makeNode("00 30 00", "Available Information"));
    put(makeNode("00 40", "Procurement Forms and Supplements", ["00 40 00"]));
    put(makeNode("00 40 00", "Procurement Forms and Supplements"));
    put(makeNode("00 50", "Contracting Forms and Supplements", ["00 50 00"]));
    put(makeNode("00 50 00", "Contracting Forms and Supplements"));
    put(makeNode("00 60", "Project Forms", ["00 60 00"]));
    put(makeNode("00 60 00", "Project Forms"));
    put(makeNode("00 62", "Certificates and Other Forms", ["00 62 16", "00 62 20", "00 62 40", "00 62 76"]));
    put(makeNode("00 62 16", "Certificate of Insurance Form"));
    put(makeNode("00 62 20", "Digital Copiers (Multi-Function)"));
    put(makeNode("00 62 40", "Wide Format Copiers"));
    put(makeNode("00 62 76", "Application for Payment Form"));
    put(makeNode("00 63", "Clarification and Modification Forms", ["00 63 00"]));
    put(makeNode("00 63 00", "Clarification and Modification Forms"));
    put(makeNode("00 65", "Certificates and Other Forms", ["00 65 13", "00 65 16", "00 65 19", "00 65 73"]));
    put(makeNode("00 65 13", "Certificate of Compliance Form"));
    put(makeNode("00 65 16", "Certificate of Substantial Completion Form"));
    put(makeNode("00 65 19", "Certificate of Completion Form"));
    put(makeNode("00 65 73", "Statutory Declaration Form"));
    put(makeNode("00 72", "General Conditions", ["00 72 00"]));
    put(makeNode("00 72 00", "General Conditions"));
    put(makeNode("00 73", "Supplementary Conditions", ["00 73 19", "00 73 53"]));
    put(makeNode("00 73 19", "Health and Safety Requirements"));
    put(makeNode("00 73 53", "Anti-Pollution Measures"));
    put(makeNode("00 90", "Revisions, Clarifications, and Modifications", ["00 90 00"]));
    put(makeNode("00 90 00", "Revisions, Clarifications, and Modifications"));

    put(makeNode("01", "General Requirements", [
      "01 10", "01 20", "01 30", "01 40", "01 50", "01 60", "01 70", "01 14", "01 18", "01 29", "01 31", "01 32", "01 33", "01 35", "01 81", "01 83", "01 92", "01 93",
    ]));
    put(makeNode("01 10 00", "Summary"));
    put(makeNode("01 20 00", "Price and Payment Procedures"));
    put(makeNode("01 30 00", "Administrative Requirements"));
    put(makeNode("01 40 00", "Quality Requirements", ["01 42 00", "01 43 00", "01 43 36", "01 45 00"]));
    put(makeNode("01 42 00", "References"));
    put(makeNode("01 43 00", "Quality Assurance"));
    put(makeNode("01 43 36", "Field Samples"));
    put(makeNode("01 45 00", "Quality Control", ["01 45 23", "01 45 29"]));
    put(makeNode("01 45 23", "Testing and Inspecting Services"));
    put(makeNode("01 45 29", "Testing Laboratory Services"));
    put(makeNode("01 50 00", "Temporary Facilities and Controls", ["01 51 00", "01 52 00", "01 53 00", "01 54 00", "01 55 00", "01 56 00", "01 57 00", "01 58 00"]));
    put(makeNode("01 51 00", "Temporary Utilities", ["01 51 16", "01 51 23", "01 51 26"]));
    put(makeNode("01 51 16", "Temporary Fire Protection"));
    put(makeNode("01 51 23", "Temporary Heating, Cooling, and Ventilating"));
    put(makeNode("01 51 26", "Temporary Lighting"));
    put(makeNode("01 52 00", "Construction Facilities", ["01 52 13"]));
    put(makeNode("01 52 13", "Field Offices and Sheds"));
    put(makeNode("01 53 00", "Temporary Construction", ["01 53 13", "01 53 16", "01 53 23"]));
    put(makeNode("01 53 13", "Temporary Bridges"));
    put(makeNode("01 53 16", "Temporary Decking"));
    put(makeNode("01 53 23", "Temporary Ramps"));
    put(makeNode("01 54 00", "Construction Aids", ["01 54 16", "01 54 19", "01 54 23", "01 54 26"]));
    put(makeNode("01 54 16", "Temporary Hoists"));
    put(makeNode("01 54 19", "Temporary Cranes"));
    put(makeNode("01 54 23", "Temporary Scaffolding and Platforms"));
    put(makeNode("01 54 26", "Temporary Swing Staging"));
    put(makeNode("01 55 00", "Vehicular Access and Parking", ["01 55 13", "01 55 16", "01 55 19", "01 55 23", "01 55 26"]));
    put(makeNode("01 55 13", "Temporary Access Roads"));
    put(makeNode("01 55 16", "Haul Routes"));
    put(makeNode("01 55 19", "Temporary Parking Areas"));
    put(makeNode("01 55 23", "Temporary Roads"));
    put(makeNode("01 55 26", "Traffic Control"));
    put(makeNode("01 56 00", "Temporary Barriers and Enclosures", [
      "01 56 13", "01 56 16", "01 56 19", "01 56 23", "01 56 26", "01 56 29", "01 56 33", "01 56 36", "01 56 39",
    ]));
    put(makeNode("01 56 13", "Temporary Air Barriers"));
    put(makeNode("01 56 16", "Temporary Dust Barriers"));
    put(makeNode("01 56 19", "Temporary Noise Barriers"));
    put(makeNode("01 56 23", "Temporary Barricades"));
    put(makeNode("01 56 26", "Temporary Fencing"));
    put(makeNode("01 56 29", "Temporary Protective Walkways"));
    put(makeNode("01 56 33", "Temporary Security Barriers"));
    put(makeNode("01 56 36", "Temporary Security Enclosures"));
    put(makeNode("01 56 39", "Temporary Tree and Plant Protection"));
    put(makeNode("01 57 00", "Temporary Controls", ["01 57 13", "01 57 16", "01 57 19", "01 57 23", "01 57 26", "01 57 33"]));
    put(makeNode("01 57 13", "Temporary Erosion and Sediment Control"));
    put(makeNode("01 57 16", "Temporary Pest Control"));
    put(makeNode("01 57 19", "Temporary Environmental Controls"));
    put(makeNode("01 57 23", "Temporary Storm Water Pollution Control"));
    put(makeNode("01 57 26", "Site Watering for Dust Control"));
    put(makeNode("01 57 33", "Temporary Security"));
    put(makeNode("01 58 00", "Project Identification"));
    put(makeNode("01 60 00", "Product Requirements", ["01 66 00"]));
    put(makeNode("01 66 00", "Product Storage and Handling Requirements", ["01 66 13"]));
    put(makeNode("01 66 13", "Product Storage and Handling Requirements for Hazardous Materials"));
    put(makeNode("01 70 00", "Execution and Closeout Requirements", ["01 71 23", "01 71 33", "01 73 00", "01 74 00", "01 79 00"]));
    put(makeNode("01 71 23", "Field Engineering"));
    put(makeNode("01 71 33", "Protection of Adjacent Construction"));
    put(makeNode("01 73 00", "Execution", ["01 73 13", "01 73 23", "01 73 29"]));
    put(makeNode("01 73 13", "Application (Installation Procedures)"));
    put(makeNode("01 73 23", "Bracing and Anchoring"));
    put(makeNode("01 73 29", "Cutting and Patching"));
    put(makeNode("01 74 00", "Cleaning and Waste Management", ["01 74 13", "01 74 19", "01 74 23"]));
    put(makeNode("01 74 13", "Progress Cleaning"));
    put(makeNode("01 74 19", "Construction Waste Management and Disposal"));
    put(makeNode("01 74 23", "Final Cleaning"));
    put(makeNode("01 79 00", "Demonstration and Training"));
    put(makeNode("01 14 13", "Access to Site"));
    put(makeNode("01 18 00", "Project Utility Sources"));
    put(makeNode("01 29 00", "Payment Procedures"));
    put(makeNode("01 31 00", "Project Management and Coordination", ["01 31 13", "01 31 16", "01 31 19"]));
    put(makeNode("01 31 13", "Project Coordination"));
    put(makeNode("01 31 16", "Multiple Contract Coordination"));
    put(makeNode("01 31 19", "Project Meetings"));
    put(makeNode("01 32 00", "Construction Progress Documentation", ["01 32 16"]));
    put(makeNode("01 32 16", "Network Analysis Schedules", ["01 32 16.13"], { note: "Subcode uses dot notation" }));
    put(makeNode("01 32 16.13", "Network Analysis Schedules"));
    put(makeNode("01 33 19", "Field Test Reporting"));
    put(makeNode("01 33 29", "Sustainable Design Reporting"));
    put(makeNode("01 35 00", "Special Procedures", ["01 35 29", "01 35 46", "01 35 53"]));
    put(makeNode("01 35 29", "Health, Safety, and Emergency Response Procedures"));
    put(makeNode("01 35 46", "Indoor Air Quality Procedures"));
    put(makeNode("01 35 53", "Security Procedures"));
    put(makeNode("01 81 19", "Indoor Air Quality Requirements"));
    put(makeNode("01 83 00", "Facility Shell Performance Requirements"));
    put(makeNode("01 92 00", "Facility Operation", ["01 92 13"]));
    put(makeNode("01 92 13", "Facility Operation Procedures"));
    put(makeNode("01 93 00", "Facility Maintenance", ["01 93 13"]));
    put(makeNode("01 93 13", "Facility Maintenance Procedures"));

    put(makeNode("02", "Existing Conditions", ["02 10", "02 20", "02 30", "02 40", "02 50", "02 60", "02 70", "02 80", "02 90"]));
    put(makeNode("02 10 00", "Reserved", [], { reserved: true }));
    put(makeNode("02 20 00", "Existing Conditions Assessment"));
    put(makeNode("02 30 00", "Subsurface Investigation"));
    put(makeNode("02 40 00", "Demolition and Structure Moving"));
    put(makeNode("02 50 00", "Site Remediation"));
    put(makeNode("02 60 00", "Contaminated Site Material Removal"));
    put(makeNode("02 70 00", "Water Remediation"));
    put(makeNode("02 80 00", "Facility Remediation"));
    put(makeNode("02 90 00", "Reserved", [], { reserved: true }));

    put(makeNode("03", "Concrete", [
      "03 01", "03 05", "03 06", "03 08", "03 10", "03 20", "03 30", "03 40", "03 50", "03 60", "03 70", "03 80", "03 90",
    ]));
    put(makeNode("03 01 00", "Maintenance of Concrete (rehabilitation and repair)", [
      "03 01 10", "03 01 30", "03 01 40", "03 01 50", "03 01 60",
    ]));
    put(makeNode("03 01 10", "Maintenance of Concrete Forming and Accessories"));
    put(makeNode("03 01 30", "Maintenance of Cast-in-Place Concrete", ["03 01 30.51", "03 01 30.61", "03 01 30.71", "03 01 30.72"], { note: "Subcodes use dot notation" }));
    put(makeNode("03 01 30.51", "Cleaning of Cast-in-Place Concrete"));
    put(makeNode("03 01 30.61", "Resurfacing of Cast-in-Place Concrete"));
    put(makeNode("03 01 30.71", "Rehabilitation of Cast-in-Place Concrete"));
    put(makeNode("03 01 30.72", "Strengthening of Cast-in-Place Concrete"));
    put(makeNode("03 01 40", "Maintenance of Precast Concrete", ["03 01 40.51", "03 01 40.61", "03 01 40.71", "03 01 40.72"], { note: "Subcodes use dot notation" }));
    put(makeNode("03 01 40.51", "Cleaning of Precast Concrete"));
    put(makeNode("03 01 40.61", "Resurfacing of Precast Concrete"));
    put(makeNode("03 01 40.71", "Rehabilitation of Precast Concrete"));
    put(makeNode("03 01 40.72", "Strengthening of Precast Concrete"));
    put(makeNode("03 01 50.51", "Cleaning of Cast Decks and Underlayment"));
    put(makeNode("03 01 50.61", "Resurfacing of Cast Decks and Underlayment"));
    put(makeNode("03 01 60", "Maintenance of Grouting"));
    put(makeNode("03 05 00", "Common Work Results for Concrete", ["03 05 05", "03 05 13"]));
    put(makeNode("03 05 05", "Selective Demolition for Concrete"));
    put(makeNode("03 05 13", "Concrete Washout (Waste Management)"));
    put(makeNode("03 06 00", "Schedules for Concrete", ["03 06 20"]));
    put(makeNode("03 06 20", "Concrete Beam Reinforcing Schedule", ["03 06 20.13"], { note: "Subcode uses dot notation" }));
    put(makeNode("03 06 20.13", "Concrete Beam Reinforcing Schedule"));
    put(makeNode("03 08 00", "Commissioning of Concrete"));
    put(makeNode("03 10 00", "Concrete Forming and Accessories", ["03 11 00", "03 15 00"]));
    put(makeNode("03 11 00", "Concrete Forming", ["03 11 13", "03 11 16", "03 11 19", "03 11 23"]));
    put(makeNode("03 11 13", "Structural Cast-in-Place Concrete Forming", ["03 11 13.13"], { note: "Subcode uses dot notation" }));
    put(makeNode("03 11 13.13", "Concrete Slip Forming"));
    put(makeNode("03 11 16", "Architectural Cast-in-Place Concrete Forming", ["03 11 16.13"], { note: "Subcode uses dot notation" }));
    put(makeNode("03 11 16.13", "Concrete Form Liners"));
    put(makeNode("03 11 19", "Insulated Concrete Forming"));
    put(makeNode("03 11 23", "Permanent Stair Forming"));
    put(makeNode("03 15 00", "Concrete Accessories", ["03 15 13", "03 15 16", "03 15 19", "03 15 21"]));
    put(makeNode("03 15 13", "Waterstops", ["03 15 13.16", "03 15 13.21"], { note: "Subcodes use dot notation" }));
    put(makeNode("03 15 13.16", "Expanding Waterstops"));
    put(makeNode("03 15 13.21", "Injection Hose Waterstops"));
    put(makeNode("03 15 16", "Concrete Construction Joints"));
    put(makeNode("03 15 19", "Cast-In Concrete Anchors"));
    put(makeNode("03 15 21", "Termite Barrier (for Concrete)"));
    put(makeNode("03 20 00", "Concrete Reinforcing", ["03 21 00", "03 22 00", "03 23 00", "03 24 00"]));
    put(makeNode("03 21 00", "Reinforcement Bars", ["03 21 19", "03 21 21"]));
    put(makeNode("03 21 19", "Stainless Steel Reinforcement Bars"));
    put(makeNode("03 21 21", "Composite Reinforcement Bars", ["03 21 21.11"], { note: "Subcode uses dot notation" }));
    put(makeNode("03 21 21.11", "Glass Fiber-Reinforced Polymer (GFRP) Bars"));
    put(makeNode("03 22 00", "Fabric and Grid Reinforcing", ["03 22 19"]));
    put(makeNode("03 22 19", "Composite Grid Reinforcing"));
    put(makeNode("03 23 00", "Stressed Tendon Reinforcing"));
    put(makeNode("03 24 00", "Fibrous Reinforcing"));
    put(makeNode("03 30 00", "Cast-in-Place Concrete", ["03 30 53", "03 31 00", "03 33 00", "03 34 00", "03 35 00", "03 37 00", "03 38 00", "03 39 00"]));
    put(makeNode("03 30 53", "Miscellaneous Cast-in-Place Concrete (e.g. fillers, equipment pads)"));
    put(makeNode("03 31 00", "Structural Concrete", ["03 31 13", "03 31 16", "03 31 19", "03 31 23", "03 31 24"]));
    put(makeNode("03 31 13", "Heavyweight Structural Concrete"));
    put(makeNode("03 31 16", "Lightweight Structural Concrete"));
    put(makeNode("03 31 19", "Shrinkage-Compensating Structural Concrete"));
    put(makeNode("03 31 23", "High-Performance Structural Concrete"));
    put(makeNode("03 31 24", "Ultra High-Performance Structural Concrete"));
    put(makeNode("03 33 00", "Architectural Concrete", ["03 33 13", "03 33 16"]));
    put(makeNode("03 33 13", "Heavyweight Architectural Concrete"));
    put(makeNode("03 33 16", "Lightweight Architectural Concrete"));
    put(makeNode("03 34 00", "Low-Density Concrete"));
    put(makeNode("03 35 00", "Concrete Finishing", [
      "03 35 13", "03 35 16", "03 35 19", "03 35 23", "03 35 26", "03 35 29", "03 35 33", "03 35 43", "03 35 46",
    ]));
    put(makeNode("03 35 13", "High-Tolerance Concrete Floor Finishing"));
    put(makeNode("03 35 16", "Heavy-Duty Concrete Floor Finishing"));
    put(makeNode("03 35 19", "Colored Concrete Finishing"));
    put(makeNode("03 35 23", "Exposed Aggregate Concrete Finishing"));
    put(makeNode("03 35 26", "Grooved Concrete Surface Finishing"));
    put(makeNode("03 35 29", "Tooled Concrete Finishing"));
    put(makeNode("03 35 33", "Stamped Concrete Finishing"));
    put(makeNode("03 35 43", "Polished Concrete Finishing", ["03 35 43.13", "03 35 43.16"], { note: "Subcodes use dot notation" }));
    put(makeNode("03 35 43.13", "Polished and Dyed Concrete Finishing"));
    put(makeNode("03 35 43.16", "Polished and Stained Concrete Finishing"));
    put(makeNode("03 35 46", "Concrete Topical Treatments"));
    put(makeNode("03 37 00", "Specialty Placed Concrete", ["03 37 13", "03 37 16", "03 37 26"]));
    put(makeNode("03 37 13", "Shotcrete (Pneumatically Placed Concrete)"));
    put(makeNode("03 37 16", "Pumped Concrete"));
    put(makeNode("03 37 26", "Underwater Placed Concrete"));
    put(makeNode("03 38 00", "Post-Tensioned Concrete", ["03 38 19"]));
    put(makeNode("03 38 19", "Bonded Post-Tensioned Concrete"));
    put(makeNode("03 39 00", "Concrete Curing", ["03 39 13", "03 39 23", "03 39 35", "03 39 37"]));
    put(makeNode("03 39 13", "Water Concrete Curing"));
    put(makeNode("03 39 23", "Membrane Concrete Curing", ["03 39 23.13"], { note: "Subcode uses dot notation" }));
    put(makeNode("03 39 23.13", "Chemical Compound Membrane Concrete Curing"));
    put(makeNode("03 39 35", "Concrete Densifiers/Sealers/Hardener Treatments"));
    put(makeNode("03 39 37", "Shake-On Concrete Floor Hardeners"));
    put(makeNode("03 40 00", "Precast Concrete", ["03 41 00", "03 45 00", "03 47 00", "03 48 00", "03 49 00"]));
    put(makeNode("03 41 00", "Precast Structural Concrete", [
      "03 41 10", "03 41 12", "03 41 13", "03 41 16", "03 41 23", "03 41 33", "03 41 36",
    ]));
    put(makeNode("03 41 10", "Plant-Precast Structural Concrete"));
    put(makeNode("03 41 12", "Site-Precast Structural Concrete"));
    put(makeNode("03 41 13", "Precast Concrete Hollow Core Planks"));
    put(makeNode("03 41 16", "Precast Concrete Slabs (Solid Planks)"));
    put(makeNode("03 41 23", "Precast Concrete Stairs"));
    put(makeNode("03 41 33", "Precast Structural Pretensioned Concrete"));
    put(makeNode("03 41 36", "Precast Structural Post-Tensioned Concrete"));
    put(makeNode("03 45 00", "Precast Architectural Concrete", ["03 45 13", "03 45 33"]));
    put(makeNode("03 45 13", "Faced Architectural Precast Concrete"));
    put(makeNode("03 45 33", "Precast Architectural Pretensioned Concrete"));
    put(makeNode("03 47 00", "Site-Cast Concrete (Tilt-Up)", ["03 47 13", "03 47 16"]));
    put(makeNode("03 47 13", "Tilt-Up Concrete"));
    put(makeNode("03 47 16", "Lift-Slab Concrete"));
    put(makeNode("03 48 00", "Precast Concrete Specialties", [
      "03 48 13", "03 48 16", "03 48 19", "03 48 26", "03 48 33", "03 48 43",
    ]));
    put(makeNode("03 48 13", "Precast Concrete Bollards", ["03 48 13.11"], { note: "Subcode uses dot notation" }));
    put(makeNode("03 48 13.11", "Precast Concrete Security Bollards"));
    put(makeNode("03 48 16", "Precast Concrete Splash Blocks"));
    put(makeNode("03 48 19", "Precast Concrete Stair Treads"));
    put(makeNode("03 48 26", "Precast Concrete Parking Bumpers"));
    put(makeNode("03 48 33", "Precast Pre-Framed Concrete Panels"));
    put(makeNode("03 48 43", "Precast Concrete Trim"));
    put(makeNode("03 49 00", "Glass-Fiber-Reinforced Concrete (GFRC)", ["03 49 13", "03 49 43"]));
    put(makeNode("03 49 13", "GFRC Column Covers"));
    put(makeNode("03 49 43", "GFRC Trim"));
    put(makeNode("03 50 00", "Cast Decks and Underlayment", ["03 51 00", "03 52 00", "03 53 00", "03 54 00"]));
    put(makeNode("03 51 00", "Cast Roof Decks", ["03 51 13", "03 51 16"]));
    put(makeNode("03 51 13", "Cementitious Wood Fiber Decks"));
    put(makeNode("03 51 16", "Gypsum Concrete Roof Decks"));
    put(makeNode("03 52 00", "Lightweight Concrete Roof Insulation", ["03 52 13", "03 52 16"]));
    put(makeNode("03 52 13", "Composite Concrete Roof Insulation"));
    put(makeNode("03 52 16", "Lightweight Insulating Concrete", ["03 52 16.13", "03 52 16.16"], { note: "Subcodes use dot notation" }));
    put(makeNode("03 52 16.13", "Lightweight Cellular Insulating Concrete"));
    put(makeNode("03 52 16.16", "Lightweight Aggregate Insulating Concrete"));
    put(makeNode("03 53 00", "Concrete Topping (Toppings)", ["03 53 19"]));
    put(makeNode("03 53 19", "Concrete Overlayment (Thin Topping)"));
    put(makeNode("03 54 00", "Cast Underlayment (Floor Underlay)", ["03 54 13", "03 54 16"]));
    put(makeNode("03 54 13", "Gypsum Cement Underlayment"));
    put(makeNode("03 54 16", "Hydraulic Cement Underlayment"));
    put(makeNode("03 60 00", "Grouting", ["03 61 00", "03 62 00", "03 63 00", "03 64 00"]));
    put(makeNode("03 61 00", "Cementitious Grouting", ["03 61 13"]));
    put(makeNode("03 61 13", "Dry-Pack Grouting"));
    put(makeNode("03 62 00", "Non-Shrink Grouting", ["03 62 13"]));
    put(makeNode("03 62 13", "Non-Shrink Grouting (premixed formulations)"));
    put(makeNode("03 63 00", "Epoxy Grouting"));
    put(makeNode("03 64 00", "Injection Grouting", ["03 64 23"]));
    put(makeNode("03 64 23", "Epoxy Injection Grouting"));
    put(makeNode("03 70 00", "Mass Concrete"));
    put(makeNode("03 80 00", "Concrete Cutting and Boring", ["03 81 00", "03 82 13"]));
    put(makeNode("03 81 00", "Concrete Cutting", ["03 81 13", "03 81 16", "03 81 19", "03 81 23", "03 81 26"]));
    put(makeNode("03 81 13", "Flat Concrete Sawing"));
    put(makeNode("03 81 16", "Track-Mounted Concrete Wall Sawing"));
    put(makeNode("03 81 19", "Wire Concrete Wall Sawing"));
    put(makeNode("03 81 23", "Hand Concrete Wall Sawing"));
    put(makeNode("03 81 26", "Chain Concrete Wall Sawing"));
    put(makeNode("03 82 13", "Concrete Core Drilling"));
    put(makeNode("03 90 00", "Reserved", [], { reserved: true }));

    // Divisions 04-14: top-level section buckets per compilation.
    // Divisions 15-19 reserved.
    // Divisions 20 (reserved), 21-28, 29-30 reserved, 31-35, 36-39 reserved, 40-46, 47 reserved, 48, 49 reserved.
    const divQuick = [
      ["04", "Masonry", ["04 10 00", "04 20 00", "04 30 00", "04 40 00", "04 50 00", "04 60 00", "04 70 00", "04 80 00", "04 90 00"]],
      ["05", "Metals", ["05 10 00", "05 20 00", "05 30 00", "05 40 00", "05 50 00", "05 60 00", "05 70 00", "05 80 00", "05 90 00"]],
      ["06", "Wood, Plastics, and Composites", ["06 10 00", "06 20 00", "06 30 00", "06 40 00", "06 50 00", "06 60 00", "06 70 00", "06 80 00", "06 90 00"]],
      ["07", "Thermal and Moisture Protection", ["07 10 00", "07 20 00", "07 25 00", "07 30 00", "07 40 00", "07 50 00", "07 60 00", "07 70 00", "07 80 00", "07 90 00"]],
      ["08", "Openings", ["08 10 00", "08 20 00", "08 30 00", "08 40 00", "08 50 00", "08 60 00", "08 70 00", "08 80 00", "08 90 00"]],
      ["09", "Finishes", ["09 10 00", "09 20 00", "09 30 00", "09 40 00", "09 50 00", "09 60 00", "09 70 00", "09 80 00", "09 90 00"]],
      ["10", "Specialties", ["10 10 00", "10 20 00", "10 30 00", "10 40 00", "10 50 00", "10 60 00", "10 70 00", "10 80 00", "10 90 00"]],
      ["11", "Equipment", ["11 10 00", "11 15 00", "11 20 00", "11 30 00", "11 40 00", "11 50 00", "11 60 00", "11 65 00", "11 70 00", "11 80 00", "11 90 00"]],
      ["12", "Furnishings", ["12 10 00", "12 20 00", "12 30 00", "12 40 00", "12 50 00", "12 60 00", "12 70 00", "12 80 00", "12 90 00"]],
      ["13", "Special Construction", ["13 10 00", "13 20 00", "13 30 00", "13 40 00", "13 50 00", "13 60 00", "13 70 00", "13 80 00", "13 90 00"]],
      ["14", "Conveying Equipment", ["14 10 00", "14 20 00", "14 30 00", "14 40 00", "14 50 00", "14 60 00", "14 70 00", "14 80 00", "14 90 00"]],
      ["15", "Reserved for Future Expansion", []],
      ["16", "Reserved for Future Expansion", []],
      ["17", "Reserved for Future Expansion", []],
      ["18", "Reserved for Future Expansion", []],
      ["19", "Reserved for Future Expansion", []],
      ["20", "Mechanical Support (Reserved)", []],
      ["21", "Fire Suppression", ["21 10 00", "21 20 00", "21 30 00", "21 40 00", "21 50 00", "21 60 00", "21 70 00", "21 80 00", "21 90 00"]],
      ["22", "Plumbing", ["22 10 00", "22 20 00", "22 30 00", "22 40 00", "22 50 00", "22 60 00", "22 70 00", "22 80 00", "22 90 00"]],
      ["23", "Heating, Ventilating, and Air Conditioning (HVAC)", ["23 10 00", "23 20 00", "23 30 00", "23 40 00", "23 50 00", "23 60 00", "23 70 00", "23 80 00", "23 90 00"]],
      ["24", "Reserved for Future Expansion", []],
      ["25", "Integrated Automation", ["25 10 00", "25 20 00", "25 30 00", "25 40 00", "25 50 00", "25 60 00", "25 70 00", "25 80 00", "25 90 00"]],
      ["26", "Electrical", ["26 10 00", "26 20 00", "26 30 00", "26 40 00", "26 50 00", "26 60 00", "26 70 00", "26 80 00", "26 90 00"]],
      ["27", "Communications", ["27 10 00", "27 20 00", "27 30 00", "27 40 00", "27 50 00", "27 60 00", "27 70 00", "27 80 00", "27 90 00"]],
      ["28", "Electronic Safety and Security", ["28 10 00", "28 20 00", "28 30 00", "28 40 00", "28 50 00", "28 60 00", "28 70 00", "28 80 00", "28 90 00"]],
      ["29", "Reserved for Future Expansion", []],
      ["30", "Reserved for Future Expansion", []],
      ["31", "Earthwork", ["31 10 00", "31 20 00", "31 30 00", "31 40 00", "31 50 00", "31 60 00", "31 70 00", "31 80 00", "31 90 00"]],
      ["32", "Exterior Improvements", ["32 10 00", "32 20 00", "32 30 00", "32 40 00", "32 50 00", "32 60 00", "32 70 00", "32 80 00", "32 90 00"]],
      ["33", "Utilities", ["33 01 00", "33 05 00", "33 10 00", "33 20 00", "33 30 00", "33 40 00", "33 50 00", "33 60 00", "33 70 00", "33 80 00", "33 90 00"]],
      ["34", "Transportation", ["34 10 00", "34 20 00", "34 30 00", "34 40 00", "34 50 00", "34 60 00", "34 70 00", "34 80 00", "34 90 00"]],
      ["35", "Waterway and Marine Construction", ["35 10 00", "35 20 00", "35 30 00", "35 40 00", "35 50 00", "35 60 00", "35 70 00", "35 80 00", "35 90 00"]],
      ["36", "Reserved for Future Expansion", []],
      ["37", "Reserved for Future Expansion", []],
      ["38", "Reserved for Future Expansion", []],
      ["39", "Reserved for Future Expansion", []],
      ["40", "Process Integration (Process Interconnections)", ["40 10 00", "40 20 00", "40 30 00", "40 40 00", "40 50 00", "40 60 00", "40 70 00", "40 80 00", "40 90 00"]],
      ["41", "Material Processing and Handling Equipment", ["41 10 00", "41 20 00", "41 30 00", "41 40 00", "41 50 00", "41 60 00", "41 70 00", "41 80 00", "41 90 00"]],
      ["42", "Process Heating, Cooling, and Drying Equipment", ["42 10 00", "42 20 00", "42 30 00", "42 40 00", "42 50 00", "42 60 00", "42 70 00", "42 80 00", "42 90 00"]],
      ["43", "Process Gas and Liquid Handling, Purification, and Storage Equipment", ["43 10 00", "43 20 00", "43 30 00", "43 40 00", "43 50 00", "43 60 00", "43 70 00", "43 80 00", "43 90 00"]],
      ["44", "Pollution and Waste Control Equipment", ["44 10 00", "44 20 00", "44 30 00", "44 40 00", "44 50 00", "44 60 00", "44 70 00", "44 80 00", "44 90 00"]],
      ["45", "Industry-Specific Manufacturing Equipment", ["45 08 00", "45 11 00", "45 13 00", "45 15 00", "45 17 00", "45 19 00", "45 21 00", "45 23 00", "45 25 00", "45 27 00", "45 29 00", "45 31 00", "45 33 00", "45 35 00", "45 37 00", "45 39 00", "45 41 00", "45 43 00", "45 45 00", "45 47 00", "45 49 00", "45 51 00", "45 60 00", "45 70 00", "45 80 00", "45 90 00"]],
      ["46", "Water and Wastewater Equipment", ["46 20 00", "46 30 00", "46 40 00", "46 50 00", "46 60 00", "46 70 00"]],
      ["47", "Reserved for Future Expansion", []],
      ["48", "Electrical Power Generation", ["48 10 00", "48 20 00", "48 30 00", "48 40 00", "48 50 00", "48 60 00", "48 70 00", "48 80 00", "48 90 00"]],
      ["49", "Reserved for Future Expansion", []],
    ];

    for (const [div, title, sections] of divQuick){
      if (!m[div]) put(makeNode(div, title, sections));
      for (const sec of sections){
        if (!m[csiNorm(sec)]){
          put(makeNode(sec, ""));
        }
      }
      if (sections.length === 0){
        const n = m[csiNorm(div)];
        if (n) n.reserved = true;
      }
    }

    // Fill in titles for section buckets that were provided in the compilation.
    const titleOnly = [
      ["04 10 00", "Reserved", true],
      ["04 20 00", "Unit Masonry", false],
      ["04 30 00", "Reserved", true],
      ["04 40 00", "Stone Assemblies", false],
      ["04 50 00", "Refractory Masonry", false],
      ["04 60 00", "Corrosion-Resistant Masonry", false],
      ["04 70 00", "Manufactured Masonry (Cast Stone)", false],
      ["04 80 00", "Reserved", true],
      ["04 90 00", "Reserved", true],

      ["05 10 00", "Structural Metal Framing", false],
      ["05 20 00", "Metal Joists", false],
      ["05 30 00", "Metal Decking", false],
      ["05 40 00", "Cold-Formed Metal Framing", false],
      ["05 50 00", "Metal Fabrications", false],
      ["05 60 00", "Reserved", true],
      ["05 70 00", "Decorative Metal", false],
      ["05 80 00", "Reserved", true],
      ["05 90 00", "Reserved", true],

      ["06 10 00", "Rough Carpentry", false],
      ["06 20 00", "Finish Carpentry (Finish Woodwork)", false],
      ["06 30 00", "Reserved", true],
      ["06 40 00", "Architectural Woodwork", false],
      ["06 50 00", "Structural Plastics", false],
      ["06 60 00", "Plastic Fabrications", false],
      ["06 70 00", "Structural Composites", false],
      ["06 80 00", "Composite Fabrications", false],
      ["06 90 00", "Reserved", true],

      ["07 10 00", "Dampproofing and Waterproofing", false],
      ["07 20 00", "Thermal Protection", false],
      ["07 25 00", "Weather Barriers", false],
      ["07 30 00", "Steep Slope Roofing", false],
      ["07 40 00", "Roofing and Siding Panels", false],
      ["07 50 00", "Membrane Roofing", false],
      ["07 60 00", "Flashing and Sheet Metal", false],
      ["07 70 00", "Roof and Wall Specialties and Accessories", false],
      ["07 80 00", "Fire and Smoke Protection", false],
      ["07 90 00", "Joint Protection", false],

      ["08 10 00", "Doors and Frames", false],
      ["08 20 00", "Reserved", true],
      ["08 30 00", "Specialty Doors and Frames", false],
      ["08 40 00", "Entrances, Storefronts, and Curtain Walls", false],
      ["08 50 00", "Windows", false],
      ["08 60 00", "Roof Windows and Skylights", false],
      ["08 70 00", "Hardware", false],
      ["08 80 00", "Glazing", false],
      ["08 90 00", "Louvers and Vents", false],

      ["09 10 00", "Reserved", true],
      ["09 20 00", "Plaster and Gypsum Board", false],
      ["09 30 00", "Tiling", false],
      ["09 40 00", "Reserved", true],
      ["09 50 00", "Ceilings", false],
      ["09 60 00", "Flooring", false],
      ["09 70 00", "Wall Finishes", false],
      ["09 80 00", "Acoustic Treatment", false],
      ["09 90 00", "Painting and Coating", false],

      ["10 10 00", "Information Specialties", false],
      ["10 20 00", "Interior Specialties", false],
      ["10 30 00", "Fireplaces and Stoves", false],
      ["10 40 00", "Safety Specialties", false],
      ["10 50 00", "Storage Specialties", false],
      ["10 60 00", "Reserved", true],
      ["10 70 00", "Exterior Specialties", false],
      ["10 80 00", "Other Specialties", false],
      ["10 90 00", "Reserved", true],

      ["11 10 00", "Vehicle and Pedestrian Equipment", false],
      ["11 15 00", "Security, Detention, and Bank Equipment", false],
      ["11 20 00", "Commercial Equipment", false],
      ["11 30 00", "Residential Equipment", false],
      ["11 40 00", "Foodservice Equipment", false],
      ["11 50 00", "Educational and Scientific Equipment", false],
      ["11 60 00", "Entertainment Equipment", false],
      ["11 65 00", "Athletic and Recreational Equipment", false],
      ["11 70 00", "Healthcare Equipment", false],
      ["11 80 00", "Collection and Disposal Equipment", false],
      ["11 90 00", "Other Equipment", false],

      ["12 10 00", "Art", false],
      ["12 20 00", "Window Treatments", false],
      ["12 30 00", "Casework", false],
      ["12 40 00", "Furnishings and Accessories", false],
      ["12 50 00", "Furniture", false],
      ["12 60 00", "Multiple Seating", false],
      ["12 70 00", "Reserved", true],
      ["12 80 00", "Interior Plants and Planters", false],
      ["12 90 00", "Other Furnishings", false],

      ["13 10 00", "Special Facility Components", false],
      ["13 20 00", "Special Purpose Rooms", false],
      ["13 30 00", "Special Structures", false],
      ["13 40 00", "Integrated Construction", false],
      ["13 50 00", "Special Instrumentation", false],
      ["13 60 00", "Reserved", true],
      ["13 70 00", "Reserved", true],
      ["13 80 00", "Reserved", true],
      ["13 90 00", "Reserved", true],

      ["14 10 00", "Dumbwaiters", false],
      ["14 20 00", "Elevators", false],
      ["14 30 00", "Escalators and Moving Walks", false],
      ["14 40 00", "Lifts", false],
      ["14 50 00", "Reserved", true],
      ["14 60 00", "Reserved", true],
      ["14 70 00", "Turntables", false],
      ["14 80 00", "Scaffolding", false],
      ["14 90 00", "Other Conveying Equipment", false],

      ["21 10 00", "Water-Based Fire-Suppression Systems", false],
      ["21 20 00", "Fire-Extinguishing Systems", false],
      ["21 30 00", "Fire Pumps", false],
      ["21 40 00", "Fire-Suppression Water Storage", false],
      ["21 50 00", "Reserved", true],
      ["21 60 00", "Reserved", true],
      ["21 70 00", "Reserved", true],
      ["21 80 00", "Reserved", true],
      ["21 90 00", "Reserved", true],

      ["22 10 00", "Plumbing Piping and Pumps", false],
      ["22 20 00", "Reserved", true],
      ["22 30 00", "Plumbing Equipment", false],
      ["22 40 00", "Plumbing Fixtures", false],
      ["22 50 00", "Pool and Fountain Plumbing Systems", false],
      ["22 60 00", "Gas and Vacuum Systems for Laboratory and Healthcare Facilities", false],
      ["22 70 00", "Reserved", true],
      ["22 80 00", "Reserved", true],
      ["22 90 00", "Reserved", true],

      ["23 10 00", "Facility Fuel Systems", false],
      ["23 20 00", "HVAC Piping and Pumps", false],
      ["23 30 00", "HVAC Air Distribution", false],
      ["23 40 00", "HVAC Air Cleaning Devices", false],
      ["23 50 00", "Central Heating Equipment", false],
      ["23 60 00", "Central Cooling Equipment", false],
      ["23 70 00", "Central HVAC Equipment", false],
      ["23 80 00", "Decentralized HVAC Equipment", false],
      ["23 90 00", "Reserved", true],

      ["25 10 00", "Integrated Automation Network Equipment", false],
      ["25 20 00", "Reserved", true],
      ["25 30 00", "Integrated Automation Instrumentation and Terminal Devices", false],
      ["25 40 00", "Reserved", true],
      ["25 50 00", "Integrated Automation Facility Controls", false],
      ["25 60 00", "Reserved", true],
      ["25 70 00", "Reserved", true],
      ["25 80 00", "Reserved", true],
      ["25 90 00", "Integrated Automation Control Sequences", false],

      ["26 10 00", "Medium-Voltage Electrical Distribution", false],
      ["26 20 00", "Low-Voltage Electrical Transmission", false],
      ["26 30 00", "Facility Electrical Power Generating and Storage Equipment", false],
      ["26 40 00", "Electrical and Cathodic Protection", false],
      ["26 50 00", "Lighting", false],
      ["26 60 00", "Reserved", true],
      ["26 70 00", "Reserved", true],
      ["26 80 00", "Reserved", true],
      ["26 90 00", "Reserved", true],

      ["27 10 00", "Structured Cabling", false],
      ["27 20 00", "Data Communications", false],
      ["27 30 00", "Voice Communications", false],
      ["27 40 00", "Audio-Video Communications", false],
      ["27 50 00", "Distributed Communications and Monitoring Systems", false],
      ["27 60 00", "Wireless Transceivers", false],
      ["27 70 00", "Reserved", true],
      ["27 80 00", "Reserved", true],
      ["27 90 00", "Reserved", true],

      ["28 10 00", "Electronic Access Control and Intrusion Detection", false],
      ["28 20 00", "Electronic Surveillance", false],
      ["28 30 00", "Electronic Detection and Alarm", false],
      ["28 40 00", "Electronic Monitoring and Control", false],
      ["28 50 00", "Reserved", true],
      ["28 60 00", "Reserved", true],
      ["28 70 00", "Reserved", true],
      ["28 80 00", "Reserved", true],
      ["28 90 00", "Reserved", true],

      ["31 10 00", "Site Clearing", false],
      ["31 20 00", "Earth Moving", false],
      ["31 30 00", "Earthwork Methods", false],
      ["31 40 00", "Shoring and Underpinning", false],
      ["31 50 00", "Excavation Support and Protection", false],
      ["31 60 00", "Special Foundations and Load-Bearing Elements", false],
      ["31 70 00", "Tunneling and Mining", false],
      ["31 80 00", "Reserved", true],
      ["31 90 00", "Reserved", true],

      ["32 10 00", "Bases, Ballasts, and Paving", false],
      ["32 20 00", "Reserved", true],
      ["32 30 00", "Site Improvements", false],
      ["32 40 00", "Reserved", true],
      ["32 50 00", "Reserved", true],
      ["32 60 00", "Reserved", true],
      ["32 70 00", "Wetlands", false],
      ["32 80 00", "Irrigation", false],
      ["32 90 00", "Planting", false],

      ["33 01 00", "Operation and Maintenance of Utilities", false],
      ["33 05 00", "Common Work Results for Utilities", false],
      ["33 10 00", "Water Utilities", false],
      ["33 20 00", "Wells", false],
      ["33 30 00", "Sanitary Sewerage Utilities", false],
      ["33 40 00", "Storm Drainage Utilities", false],
      ["33 50 00", "Fuel Distribution Utilities", false],
      ["33 60 00", "Hydronic and Steam Energy Utilities", false],
      ["33 70 00", "Electrical Utilities", false],
      ["33 80 00", "Communications Utilities", false],
      ["33 90 00", "Reserved", true],

      ["34 10 00", "Guideways/Railways", false],
      ["34 20 00", "Traction Power", false],
      ["34 30 00", "Reserved", true],
      ["34 40 00", "Transportation Signaling and Control Equipment", false],
      ["34 50 00", "Transportation Fare Collection Equipment", false],
      ["34 60 00", "Reserved", true],
      ["34 70 00", "Transportation Construction and Equipment", false],
      ["34 80 00", "Bridges", false],
      ["34 90 00", "Reserved", true],

      ["35 10 00", "Waterway and Marine Signaling & Control Equipment", false],
      ["35 20 00", "Waterway and Marine Construction & Equipment", false],
      ["35 30 00", "Coastal Construction", false],
      ["35 40 00", "Waterway Construction & Equipment", false],
      ["35 50 00", "Marine Construction & Equipment", false],
      ["35 60 00", "Reserved", true],
      ["35 70 00", "Dam Construction & Equipment", false],
      ["35 80 00", "Reserved", true],
      ["35 90 00", "Reserved", true],

      ["40 10 00", "Gas and Vapor Process Piping", false],
      ["40 20 00", "Liquids Process Piping", false],
      ["40 30 00", "Solid and Mixed Materials Piping and Chutes", false],
      ["40 40 00", "Process Piping and Equipment Protection", false],
      ["40 50 00", "Reserved", true],
      ["40 60 00", "Reserved", true],
      ["40 70 00", "Reserved", true],
      ["40 80 00", "Commissioning of Process Systems", false],
      ["40 90 00", "Instrumentation and Control for Process Systems", false],

      ["41 10 00", "Bulk Material Processing Equipment", false],
      ["41 20 00", "Piece Material Handling Equipment", false],
      ["41 30 00", "Manufacturing Equipment", false],
      ["41 40 00", "Container Processing and Packaging", false],
      ["41 50 00", "Material Storage", false],
      ["41 60 00", "Mobile Plant Equipment", false],
      ["41 70 00", "Reserved", true],
      ["41 80 00", "Reserved", true],
      ["41 90 00", "Reserved", true],

      ["42 10 00", "Process Heating Equipment", false],
      ["42 20 00", "Process Cooling Equipment", false],
      ["42 30 00", "Process Drying Equipment", false],
      ["42 40 00", "Reserved", true],
      ["42 50 00", "Reserved", true],
      ["42 60 00", "Reserved", true],
      ["42 70 00", "Reserved", true],
      ["42 80 00", "Reserved", true],
      ["42 90 00", "Reserved", true],

      ["43 10 00", "Gas Handling Equipment", false],
      ["43 20 00", "Liquid Handling Equipment", false],
      ["43 30 00", "Gas & Liquid Purification Equipment", false],
      ["43 40 00", "Gas & Liquid Storage", false],
      ["43 50 00", "Reserved", true],
      ["43 60 00", "Reserved", true],
      ["43 70 00", "Reserved", true],
      ["43 80 00", "Reserved", true],
      ["43 90 00", "Reserved", true],

      ["44 10 00", "Air Pollution Control", false],
      ["44 20 00", "Noise Pollution Control", false],
      ["44 30 00", "Odor Control", false],
      ["44 40 00", "Water Pollution Control Equipment", false],
      ["44 50 00", "Solid Waste Control", false],
      ["44 60 00", "Waste Thermal Processing Equipment", false],
      ["44 70 00", "Reserved", true],
      ["44 80 00", "Reserved", true],
      ["44 90 00", "Reserved", true],

      ["45 08 00", "Commissioning of Industry-Specific Manufacturing Equipment", false],
      ["45 11 00", "Oil & Gas Extraction Equipment", false],
      ["45 13 00", "Mining Machinery & Equipment", false],
      ["45 15 00", "Food Manufacturing Equipment", false],
      ["45 17 00", "Beverage & Tobacco Product Manufacturing Equipment", false],
      ["45 19 00", "Textiles & Apparel Manufacturing Equipment", false],
      ["45 21 00", "Leather & Allied Product Manufacturing Equipment", false],
      ["45 23 00", "Wood Product Manufacturing Equipment", false],
      ["45 25 00", "Paper Manufacturing Equipment", false],
      ["45 27 00", "Printing & Related Manufacturing Equipment", false],
      ["45 29 00", "Petroleum & Coal Products Manufacturing Equipment", false],
      ["45 31 00", "Chemical Manufacturing Equipment", false],
      ["45 33 00", "Plastics & Rubber Manufacturing Equipment", false],
      ["45 35 00", "Nonmetallic Mineral Product Manufacturing Equipment", false],
      ["45 37 00", "Primary Metal Manufacturing Equipment", false],
      ["45 39 00", "Fabricated Metal Product Manufacturing Equipment", false],
      ["45 41 00", "Machinery Manufacturing Equipment", false],
      ["45 43 00", "Computer & Electronic Product Manufacturing Equipment", false],
      ["45 45 00", "Electrical Equipment, Appliance & Component Manufacturing Equipment", false],
      ["45 47 00", "Transportation Manufacturing Equipment", false],
      ["45 49 00", "Furniture & Related Products Manufacturing Equipment", false],
      ["45 51 00", "Other Manufacturing Equipment", false],
      ["45 60 00", "Reserved", true],
      ["45 70 00", "Reserved", true],
      ["45 80 00", "Reserved", true],
      ["45 90 00", "Reserved", true],

      ["46 20 00", "Preliminary Treatment Equipment", false],
      ["46 30 00", "Chemical Feed Equipment", false],
      ["46 40 00", "Clarification and Mixing Equipment", false],
      ["46 50 00", "Secondary Treatment Equipment", false],
      ["46 60 00", "Advanced Treatment Equipment", false],
      ["46 70 00", "Residuals Handling and Treatment Equipment", false],

      ["48 10 00", "Electrical Power Generation Equipment", false],
      ["48 20 00", "Reserved", true],
      ["48 30 00", "Reserved", true],
      ["48 40 00", "Reserved", true],
      ["48 50 00", "Reserved", true],
      ["48 60 00", "Reserved", true],
      ["48 70 00", "Electrical Power Generation Testing", false],
      ["48 80 00", "Reserved", true],
      ["48 90 00", "Reserved", true],
    ];
    for (const [code, title, reserved] of titleOnly){
      const key = csiNorm(code);
      if (m[key]){
        m[key].title = title;
        if (reserved) m[key].reserved = true;
      }else{
        put(makeNode(code, title, [], { reserved }));
      }
    }

    return m;
  })();

  function csiLookup(code){
    const k = csiNorm(code);
    return CSI_MASTERFORMAT[k] || null;
  }

  function keyForCsi(code){
    const normalized = csiNorm(code);
    const safe = normalized.replace(/[^0-9A-Za-z]+/g, "_").replace(/^_+|_+$/g, "");
    return safe ? `csi_${safe}` : "csi_unassigned";
  }

  baseFns.csi_norm = defFn("csi_norm", 1, {
    args: [{ label: "code", kinds: ["any"] }],
    returns: { kinds: ["string"] },
  }, (code) => csiNorm(code));
  baseFns.csi_div = defFn("csi_div", 1, {
    args: [{ label: "code", kinds: ["any"] }],
    returns: { kinds: ["string"] },
  }, (code) => csiDiv(code));
  baseFns.csi_section = defFn("csi_section", 1, {
    args: [{ label: "code", kinds: ["any"] }],
    returns: { kinds: ["string"] },
  }, (code) => csiSection(code));
  baseFns.csi_item = defFn("csi_item", 1, {
    args: [{ label: "code", kinds: ["any"] }],
    returns: { kinds: ["string"] },
  }, (code) => csiItem(code));

  baseFns.csi_title = defFn("csi_title", 1, {
    args: [{ label: "code", kinds: ["any"] }],
    returns: { kinds: ["string"] },
  }, (code) => {
    const node = csiLookup(code);
    return node ? (node.title || "") : "";
  });

  baseFns.csi_children = defFn("csi_children", 1, {
    args: [{ label: "code", kinds: ["any"] }],
    returns: { kinds: ["string"] },
  }, (code) => {
    const node = csiLookup(code);
    if (!node) return "";
    return (node.children || []).join(",");
  });

  baseFns.csi_node = defFn("csi_node", 1, {
    args: [{ label: "code", kinds: ["any"] }],
    returns: { kinds: ["assy"] },
  }, (code) => {
    const normalized = csiNorm(code);
    const node = csiLookup(code);
    const n = node || makeNode(normalized, "");
    const fields = Object.create(null);
    fields.code = fieldInfo(n.code || normalized);
    fields.title = fieldInfo(n.title || "");
    fields.kind = fieldInfo(n.kind || csiKind(normalized));
    fields.parent = fieldInfo(n.parent || csiParentCode(normalized));
    fields.children = fieldInfo((n.children || []).join(","));
    fields.reserved = fieldInfo(n.reserved ? 1 : 0);
    fields.note = fieldInfo(n.note || "");
    return { __assy: true, name: "csi", fields, __csi: true };
  });

  baseFns.csi_rollup = defFn("csi_rollup", -1, {
    args: [],
    returns: { kinds: ["assy"] },
  }, (...lines) => {
    if (!lines.length) throw new Error("csi_rollup expects at least one line");
    let grand = null;
    let n = 0;
    const byCsi = Object.create(null);

    for (const item of lines){
      const line = requireLine(item, "csi_rollup");
      const total = line.fields?.total?.value;
      const csi = line.fields?.csi?.value || "";
      if (total === undefined) continue;
      grand = grand === null ? total : add(grand, total);
      const key = keyForCsi(csi);
      byCsi[key] = byCsi[key] === undefined ? total : add(byCsi[key], total);
      n += 1;
    }

    const fields = Object.create(null);
    fields.total = { value: grand === null ? 0 : grand, note: "", raw: "" };
    fields.n = { value: n, note: "", raw: "" };
    for (const [k, v] of Object.entries(byCsi)){
      fields[k] = { value: v, note: "", raw: "" };
    }

    return { __assy: true, name: "csi_rollup", fields, __rollup: true, __csi: true };
  });
}
