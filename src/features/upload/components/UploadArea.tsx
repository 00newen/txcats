'use client';

import { useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { UploadCloud } from 'lucide-react';
import { ParseResult } from '@/features/upload/types';
import { useToast } from '@/hooks/use-toast';
import { parseCsv } from '../utils/parser';

interface UploadAreaProps {
    onParseComplete: (result: ParseResult, file: File) => void;
}

export function UploadArea({ onParseComplete }: UploadAreaProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const { toast } = useToast();

    const handleFile = async (file: File) => {
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            toast({ title: "Invalid file", description: "Please upload a CSV file.", variant: "destructive" });
            return;
        }

        setIsParsing(true);
        try {
            const result = await parseCsv(file);
            if (result.errors.length > 0) {
                toast({
                    title: "Warning: Possible parsing issues",
                    description: `Found ${result.errors.length} errors/warnings, but showing data anyway.`,
                    variant: "default"
                });
            }
            onParseComplete(result, file);
        } catch (e) {
            console.error(e);
            toast({ title: "Parsing Error", description: "Failed to parse the CSV file.", variant: "destructive" });
        } finally {
            setIsParsing(false);
        }
    };

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, []);

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    };

    return (
        <Card
            className={`border-2 border-dashed transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
        >
            <CardContent
                className="flex flex-col items-center justify-center py-12 space-y-4 cursor-pointer"
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => document.getElementById('csv-upload-input')?.click()}
            >
                <div className="bg-muted p-4 rounded-full">
                    <UploadCloud className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-lg font-semibold">Click to upload or drag and drop</h3>
                    <p className="text-sm text-muted-foreground">
                        CSV files only (max 10MB)
                    </p>
                </div>
                <input
                    id="csv-upload-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={onInputChange}
                    disabled={isParsing}
                />
                {isParsing && <p className="text-sm font-medium animate-pulse">Parsing...</p>}
            </CardContent>
        </Card>
    );
}
