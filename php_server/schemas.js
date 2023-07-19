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
  for (var attr in schemas['dependencies']) {
    fields.push(attr);
  }
  for (var attr in schemas['properties']) {
    fields.push(attr);
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
