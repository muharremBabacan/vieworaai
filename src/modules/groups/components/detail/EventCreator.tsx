'use client';
import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

const ISTANBUL_TEMPLATES = [
    { title: "template_galata_title", start_point: "Galata Kulesi", end_point: "Galataport", duration_minutes: 90, distance_km: 1.5, route_points: [{ name: "Galata Kulesi", type: "start" }, { name: "Serdar-ı Ekrem Sokak", type: "photo_stop" }, { name: "Kamondo Merdivenleri", type: "photo_stop" }, { name: "Karaköy Sahil", type: "break" }, { name: "Galataport", type: "end" }] },
    { title: "template_balat_title", start_point: "Balat Renkli Evler", end_point: "Fener Rum Patrikhanesi", duration_minutes: 120, distance_km: 2.0, route_points: [{ name: "Balat Renkli Evler", type: "start" }, { name: "Merdivenli Yokuş", type: "viewpoint" }, { name: "Çıfıt Çarşısı", type: "photo_stop" }, { name: "Balat Sahil", type: "break" }, { name: "Fener Rum Patrikhanesi", type: "end" }] }
];

interface EventCreatorProps {
    onCreate: (data: any) => void;
}

export function EventCreator({ onCreate }: EventCreatorProps) {
  const t = useTranslations('GroupDetailPage');
  const [formData, setFormData] = useState({ 
    title: '', 
    description: '', 
    startPoint: '', 
    endPoint: '', 
    date: '', 
    max_participants: 15,
    requiredTag: '' 
  });

  const handleTemplateSelect = (title: string) => { 
    const tmpl = ISTANBUL_TEMPLATES.find(x => x.title === title); 
    if (tmpl) setFormData({ 
        ...formData, 
        title: t(tmpl.title), 
        startPoint: tmpl.start_point, 
        endPoint: tmpl.end_point 
    }); 
  };

  return (
    <div className="space-y-4">
      <Select onValueChange={handleTemplateSelect}>
        <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder={t('admin_form_route_placeholder')} />
        </SelectTrigger>
        <SelectContent>
            {ISTANBUL_TEMPLATES.map(tmpl => <SelectItem key={tmpl.title} value={tmpl.title}>{t(tmpl.title)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder={t('admin_form_title_placeholder')} className="rounded-xl h-11" />
      <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder={t('admin_form_desc_placeholder')} className="rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-10" />
        <Input 
          type="number" 
          value={isNaN(formData.max_participants) ? '' : formData.max_participants} 
          onChange={e => {
            const val = e.target.value === '' ? NaN : parseInt(e.target.value);
            setFormData({ ...formData, max_participants: val });
          }} 
          placeholder={t('admin_form_count_placeholder')} 
          className="h-10" 
        />
      </div>
      <Input 
        value={formData.requiredTag} 
        onChange={e => setFormData({ ...formData, requiredTag: e.target.value })} 
        placeholder={t('admin_form_required_tag_placeholder') || 'Zorunlu Etiket (Opsiyonel)'} 
        className="rounded-xl h-11" 
      />
      <Button onClick={() => onCreate(formData)} className="w-full h-12 rounded-xl font-black uppercase shadow-lg shadow-primary/20">{t('admin_button_publish')}</Button>
    </div>
  );
}
