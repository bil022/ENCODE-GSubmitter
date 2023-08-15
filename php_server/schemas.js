'use strict';

const fs = require('fs');
const output={};

const tabs={
  "experiment": "Experiment",
  "library": "Library",
  "replicate": "Replicate",
  "functional_characterization_experiment": "FunctionalCharacterizationExperiment",
  "biosample": "Biosample",
  "functional_characterization_series": "FunctionalCharacterizationSeries",
  "genetic_modification": "GeneticModification",
  "reference": "Reference"
};

const [ bin, sourcePath, ...args ] = process.argv;
for (var json in args) {
  // console.log(args[json]);
  let file=args[json];
  var id=file.match(/\/(.*).json/)[1];
  // console.log(file,"=>",id);

  let rawdata = fs.readFileSync(file);
  let schemas = JSON.parse(rawdata);
  let fields = Array();
  const attrs=['dependencies', 'required', 'properties', 'mixinProperties'];
  for (var idx in attrs) {
    // console.log("attr:" + attrs[idx]);
    let attr=attrs[idx];
    let data=schemas[attr];
    if (Array.isArray(data)) {
      for (var val in data) {
	if (typeof data[val] == "object") {
          let ref = data[val]["$ref"];
	  let key = ref.split('/')[1];
	  // "$ref": "mixins.json#/genetic_modifications"
          // console.log("\t=>" + key);
          fields.push(key);
	} else {
          fields.push(data[val]);
        }
      }
    } else {
      for (var val in data) {
        // console.log("\t" + val);
        fields.push(val);
      }
    }
  }

  output[tabs[id]]={"URI":id, "FIELDS": fields};
}

console.log(JSON.stringify(output, null, 2));

/*
  "Library" : {
    "URI" : "libraries",
    "FIELDS": ["award", "lab", "nucleic_acid_term_id", "nucleic_acid_term_name", "biosample", "paired_ended", "size_range", "fragmentation_method", "lysis_method", "library_size_selection_method", "documents", "nucleic_acid_starting_quantity", "nucleic_acid_starting_quantity_units"]
  },
*/
