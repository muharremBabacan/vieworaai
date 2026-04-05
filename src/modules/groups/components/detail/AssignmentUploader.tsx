'use client';
import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Loader2, ImageIcon } from "lucide-react";

interface AssignmentUploaderProps {
    onUpload: (file: File) => void;
    isUploading: boolean;
    t: any;
}

export function AssignmentUploader({ onUpload, isUploading, t }: AssignmentUploaderProps) {
    const onDrop = useCallback((files: File[]) => { 
        if (files.length > 0) onUpload(files[0]); 
    }, [onUpload]);

    const { getRootProps, getInputProps } = useDropzone({ 
        onDrop, 
        accept: { 'image/*': [] }, 
        multiple: false 
    });

    return (
        <div {...getRootProps()} className="border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer hover:bg-primary/5 transition-colors">
            <input {...getInputProps()} />
            <div className="h-12 w-12 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-3">
                {isUploading ? <Loader2 className="animate-spin text-primary" /> : <ImageIcon size={24} />}
            </div>
            <p className="font-black uppercase text-sm">{t('assignment_button_submit')}</p>
        </div>
    );
}
