
import React, { useRef } from 'react';
import { DownloadIcon, UploadIcon, TrashIcon, ChartPieIcon } from './icons';

interface HeaderProps {
    onImport: (file: File) => void;
    onExport: () => void;
    onClear: () => void;
}

const Header: React.FC<HeaderProps> = ({ onImport, onExport, onClear }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onImport(file);
        }
        // Reset file input to allow re-uploading the same file
        event.target.value = '';
    };

    return (
        <header className="bg-brand-surface border-b border-brand-border p-4 shadow-md">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <ChartPieIcon className="w-8 h-8 text-brand-primary" />
                    <div>
                        <h1 className="text-xl font-bold text-brand-text-primary">E-Sports Bet Tracker</h1>
                        <p className="text-sm text-brand-text-secondary">Gerencie suas apostas e analise seu desempenho com IA.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".json"
                        className="hidden"
                    />
                    <button onClick={handleImportClick} className="p-2 rounded-md hover:bg-brand-border transition-colors" title="Importar Dados (JSON)">
                        <UploadIcon className="w-5 h-5 text-brand-text-secondary" />
                    </button>
                    <button onClick={onExport} className="p-2 rounded-md hover:bg-brand-border transition-colors" title="Exportar Dados (JSON)">
                        <DownloadIcon className="w-5 h-5 text-brand-text-secondary" />
                    </button>
                    <button onClick={onClear} className="p-2 rounded-md hover:bg-brand-border transition-colors" title="Limpar Todos os Dados">
                        <TrashIcon className="w-5 h-5 text-brand-danger" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
