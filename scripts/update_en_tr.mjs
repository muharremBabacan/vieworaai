import fs from 'fs';
import path from 'path';

const msgDir = path.join(process.cwd(), 'src', 'messages');

const dataEn = JSON.parse(fs.readFileSync(path.join(msgDir, 'en.json'), 'utf-8'));
const dataTr = JSON.parse(fs.readFileSync(path.join(msgDir, 'tr.json'), 'utf-8'));

// AppLayout
if (!dataEn.AppLayout) dataEn.AppLayout = {};
dataEn.AppLayout.fallback_artist = "Anonymous Artist";
if (!dataTr.AppLayout) dataTr.AppLayout = {};
dataTr.AppLayout.fallback_artist = "Adsız Sanatçı";

// GalleryPage
if (!dataEn.GalleryPage) dataEn.GalleryPage = {};
dataEn.GalleryPage.filter_category_portrait = "Portrait";
dataEn.GalleryPage.filter_category_landscape = "Landscape";
dataEn.GalleryPage.filter_category_street = "Street";
dataEn.GalleryPage.filter_category_architecture = "Architecture";
dataEn.GalleryPage.filter_category_pets = "Pets";
dataEn.GalleryPage.filter_category_macro = "Macro";

if (!dataTr.GalleryPage) dataTr.GalleryPage = {};
dataTr.GalleryPage.filter_category_portrait = "Portre";
dataTr.GalleryPage.filter_category_landscape = "Manzara";
dataTr.GalleryPage.filter_category_street = "Sokak";
dataTr.GalleryPage.filter_category_architecture = "Mimari";
dataTr.GalleryPage.filter_category_pets = "Evcil Hayvanlar";
dataTr.GalleryPage.filter_category_macro = "Makro";

// GroupsPage
if (!dataEn.GroupsPage) dataEn.GroupsPage = {};
dataEn.GroupsPage.purpose_study = "Study";
dataEn.GroupsPage.purpose_challenge = "Challenge";
dataEn.GroupsPage.purpose_walk = "Photo Walk";
dataEn.GroupsPage.purpose_mentor = "Mentor";

if (!dataTr.GroupsPage) dataTr.GroupsPage = {};
dataTr.GroupsPage.purpose_study = "Eğitim";
dataTr.GroupsPage.purpose_challenge = "Yarışma";
dataTr.GroupsPage.purpose_walk = "Gezi";
dataTr.GroupsPage.purpose_mentor = "Eğitimci";

fs.writeFileSync(path.join(msgDir, 'en.json'), JSON.stringify(dataEn, null, 2) + '\n');
fs.writeFileSync(path.join(msgDir, 'tr.json'), JSON.stringify(dataTr, null, 2) + '\n');

console.log('Added missing keys to en.json and tr.json.');
