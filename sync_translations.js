const fs = require('fs');

const trPath = 'd:/viewora/viewora/src/messages/tr.json';
const enPath = 'd:/viewora/viewora/src/messages/en.json';

function updateJson(filePath, updates, removeKeys = []) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (content.GroupsPage) {
    // Apply updates
    Object.assign(content.GroupsPage, updates);
    
    // Remove keys
    removeKeys.forEach(key => {
      delete content.GroupsPage[key];
    });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
  console.log(`Updated ${filePath}`);
}

// Turkish Updates
const trUpdates = {
  "form_error_name_min": "Grup ismi en az 3 karakter olmalıdır.",
  "form_error_name_max": "Grup ismi en fazla 50 karakter olabilir.",
  "form_error_description_max": "Açıklama en fazla 200 karakter olabilir.",
  "form_error_purpose_required": "Lütfen bir grup amacı seçin.",
  "form_placeholder_comp_subject": "Örn: Sokak Fotoğrafçılığı"
};

// English Updates
const enUpdates = {
  "form_label_description": "Group Description",
  "form_error_name_min": "Group name must be at least 3 characters.",
  "form_error_name_max": "Group name can be up to 50 characters.",
  "form_error_description_max": "Description can be up to 200 characters.",
  "form_error_purpose_required": "Please select a group purpose.",
  "form_placeholder_comp_subject": "e.g., Street Photography"
};

// Run updates
// For TR, we don't need to remove specific keys except if we want to be sure about duplicates handled by the Object.assign
updateJson(trPath, trUpdates); 
updateJson(enPath, enUpdates, ["form_label_group_description"]);

console.log("Translation sync complete.");
