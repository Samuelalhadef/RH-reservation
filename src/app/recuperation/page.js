'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { formatDateFR, getStatusColor, formatStatus } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

export default function RecuperationPage() {
  const { user, isAuthenticated, isRH } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [demandes, setDemandes] = useState([]);
  const [heuresAcquises, setHeuresAcquises] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [showDocument, setShowDocument] = useState(false);
  const [formData, setFormData] = useState({
    date_travail: '',
    nombre_heures: '',
    raison: '',
    type_compensation: ''
  });
  const [signature, setSignature] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [selectedDemande, setSelectedDemande] = useState(null);

  // Signature canvas
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else {
      fetchData();
    }
  }, [isAuthenticated, router]);

  const fetchData = async () => {
    try {
      const [recupRes, profileRes] = await Promise.all([
        fetch('/api/recuperation').then(r => r.json()),
        fetch('/api/users/profile').then(r => r.json())
      ]);
      setDemandes(recupRes.demandes || []);
      setHeuresAcquises(recupRes.heures_acquises || 0);
      setProfile(profileRes.user || null);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // --- Signature Canvas Logic ---
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    if (showDocument) {
      setTimeout(initCanvas, 100);
    }
  }, [showDocument, initCanvas]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    isDrawingRef.current = true;
    lastPosRef.current = getPos(e);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    // Check if canvas has content
    const ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasContent = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) { hasContent = true; break; }
    }
    if (!hasContent) return null;
    return canvas.toDataURL('image/png');
  };

  // --- Form Validation & Document Preview ---
  const handleShowDocument = () => {
    if (!formData.date_travail || !formData.nombre_heures || !formData.raison || !formData.type_compensation) {
      toast.error('Veuillez remplir tous les champs avant de prévisualiser le document');
      return;
    }
    setShowDocument(true);
  };

  const handleSubmit = async () => {
    const sig = saveSignature();
    if (!sig) {
      toast.error('Veuillez signer le document avant de l\'envoyer');
      return;
    }
    setSignature(sig);
    setSubmitting(true);

    try {
      const response = await fetch('/api/recuperation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          signature: sig,
          document_data: JSON.stringify({
            nom: profile?.nom,
            prenom: profile?.prenom,
            service: profile?.service,
            poste: profile?.poste,
            date_travail: formData.date_travail,
            nombre_heures: formData.nombre_heures,
            raison: formData.raison,
            type_compensation: formData.type_compensation,
            date_signature: new Date().toISOString()
          })
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      toast.success('Demande envoyée avec succès');
      setShowForm(false);
      setShowDocument(false);
      setFormData({ date_travail: '', nombre_heures: '', raison: '', type_compensation: '' });
      setSignature(null);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintDocument = (demande) => {
    setSelectedDemande(demande);
  };

  const formatTypeCompensation = (type) => {
    return type === 'remuneration' ? 'Rémunération' : 'Récupération en congé';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Jours de récupération</h1>
            <p className="text-sm text-gray-600">Gérez vos demandes d'heures supplémentaires</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setShowDocument(false); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            + Nouvelle demande
          </button>
        </div>

        {/* Solde de récupération */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-600 mb-1">Heures de récupération acquises</p>
            <p className="text-3xl font-bold text-blue-600">{heuresAcquises}h</p>
            <p className="text-xs text-gray-500 mt-1">
              Soit environ {(heuresAcquises / 7).toFixed(1)} jour(s)
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-600 mb-1">Demandes en attente</p>
            <p className="text-3xl font-bold text-yellow-600">
              {demandes.filter(d => d.statut === 'en_attente').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-600 mb-1">Demandes validées</p>
            <p className="text-3xl font-bold text-green-600">
              {demandes.filter(d => d.statut === 'validee').length}
            </p>
          </div>
        </div>

        {/* Formulaire de nouvelle demande */}
        {showForm && !showDocument && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Nouvelle demande de récupération</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date du travail supplémentaire
                </label>
                <input
                  type="date"
                  value={formData.date_travail}
                  onChange={(e) => setFormData({ ...formData, date_travail: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre d'heures
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={formData.nombre_heures}
                  onChange={(e) => setFormData({ ...formData, nombre_heures: e.target.value })}
                  placeholder="Ex: 3.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raison / Description du travail effectué
                </label>
                <textarea
                  value={formData.raison}
                  onChange={(e) => setFormData({ ...formData, raison: e.target.value })}
                  rows={3}
                  placeholder="Décrivez le travail supplémentaire effectué..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Type de compensation souhaitée
                </label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition ${
                    formData.type_compensation === 'recuperation'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="type_compensation"
                      value="recuperation"
                      checked={formData.type_compensation === 'recuperation'}
                      onChange={(e) => setFormData({ ...formData, type_compensation: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <p className="font-medium text-gray-800">Récupération en congé</p>
                      <p className="text-xs text-gray-500">Convertir en heures/jours de récupération</p>
                    </div>
                  </label>

                  <label className={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition ${
                    formData.type_compensation === 'remuneration'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="type_compensation"
                      value="remuneration"
                      checked={formData.type_compensation === 'remuneration'}
                      onChange={(e) => setFormData({ ...formData, type_compensation: e.target.value })}
                      className="w-4 h-4 text-green-600"
                    />
                    <div>
                      <p className="font-medium text-gray-800">Rémunération</p>
                      <p className="text-xs text-gray-500">Être payé pour les heures supplémentaires</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleShowDocument}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
              >
                Générer le document officiel
              </button>
            </div>
          </div>
        )}

        {/* Document officiel + Signature */}
        {showDocument && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Document officiel - Signature requise</h2>
              <button onClick={() => setShowDocument(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Document officiel */}
            <div id="document-officiel" className="border-2 border-gray-300 rounded-lg p-6 sm:p-8 mb-6 bg-white">
              <div className="text-center mb-6">
                <div className="flex justify-center mb-3">
                  <img src="/images/logo.png" alt="Logo" className="w-16 h-16 object-contain" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
                  Commune de Chartrettes
                </h3>
                <p className="text-sm text-gray-600 mt-1">Service des Ressources Humaines</p>
                <div className="w-24 h-0.5 bg-gray-400 mx-auto mt-3"></div>
              </div>

              <h4 className="text-center text-lg font-bold text-gray-800 mb-6 uppercase">
                Demande de {formData.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération'} d'Heures Supplémentaires
              </h4>

              <div className="space-y-4 text-sm text-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <span className="font-semibold">Nom :</span> {profile?.nom || ''}
                  </div>
                  <div>
                    <span className="font-semibold">Prénom :</span> {profile?.prenom || ''}
                  </div>
                  <div>
                    <span className="font-semibold">Service :</span> {profile?.service || 'Non renseigné'}
                  </div>
                  <div>
                    <span className="font-semibold">Poste :</span> {profile?.poste || 'Non renseigné'}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <p className="mb-3">
                    Je soussigné(e) <span className="font-semibold">{profile?.prenom} {profile?.nom}</span>,
                    déclare avoir effectué des heures de travail supplémentaires dans les conditions suivantes :
                  </p>

                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <p>
                      <span className="font-semibold">Date du travail supplémentaire :</span>{' '}
                      {formData.date_travail ? formatDateFR(formData.date_travail) : ''}
                    </p>
                    <p>
                      <span className="font-semibold">Nombre d'heures effectuées :</span>{' '}
                      {formData.nombre_heures} heure(s)
                    </p>
                    <p>
                      <span className="font-semibold">Nature du travail :</span>{' '}
                      {formData.raison}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <p className="mb-2">
                    <span className="font-semibold">Compensation demandée :</span>
                  </p>
                  <div className="flex items-center gap-2 ml-4">
                    <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                      formData.type_compensation === 'recuperation' ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
                    }`}>
                      {formData.type_compensation === 'recuperation' && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span>Récupération en jours de congé</span>
                  </div>
                  <div className="flex items-center gap-2 ml-4 mt-1">
                    <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                      formData.type_compensation === 'remuneration' ? 'border-green-500 bg-green-500' : 'border-gray-400'
                    }`}>
                      {formData.type_compensation === 'remuneration' && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span>Rémunération des heures supplémentaires</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs text-gray-500 italic mb-4">
                    En signant ce document, je certifie sur l'honneur l'exactitude des informations ci-dessus
                    et demande le traitement de ma requête conformément à la réglementation en vigueur.
                  </p>

                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm font-semibold">Fait à Chartrettes,</p>
                      <p className="text-sm">Le {formatDateFR(new Date().toISOString())}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold mb-1">Signature de l'agent</p>
                      <div className="w-48 h-0.5 bg-gray-400"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Zone de signature */}
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Signez ci-dessous avec la souris ou le doigt :
              </p>
              <canvas
                ref={canvasRef}
                className="w-full border border-gray-300 rounded-lg bg-white cursor-crosshair touch-none"
                style={{ height: '150px' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <div className="flex justify-between mt-2">
                <button
                  onClick={clearSignature}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Effacer la signature
                </button>
                <p className="text-xs text-gray-500">La signature est obligatoire</p>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => { setShowDocument(false); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
              >
                Retour au formulaire
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Envoi en cours...' : 'Signer et envoyer'}
              </button>
            </div>
          </div>
        )}

        {/* Liste des demandes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-800">Mes demandes de récupération</h2>
          </div>

          {demandes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Aucune demande de récupération</p>
              <p className="text-sm mt-1">Créez votre première demande en cliquant sur le bouton ci-dessus</p>
            </div>
          ) : (
            <>
              {/* Version desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date travail</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Heures</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Raison</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date demande</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {demandes.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{d.date_travail_fr}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{d.nombre_heures}h</td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{d.raison}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            d.type_compensation === 'remuneration'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {formatTypeCompensation(d.type_compensation)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusColor(d.statut)}`}>
                            {formatStatus(d.statut)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{d.date_demande_fr}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => handlePrintDocument(d)}
                            className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                          >
                            Voir document
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Version mobile */}
              <div className="md:hidden divide-y divide-gray-200">
                {demandes.map((d) => (
                  <div key={d.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">{d.date_travail_fr} - {d.nombre_heures}h</p>
                        <p className="text-sm text-gray-600 mt-1">{d.raison}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusColor(d.statut)}`}>
                        {formatStatus(d.statut)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        d.type_compensation === 'remuneration'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {formatTypeCompensation(d.type_compensation)}
                      </span>
                      <button
                        onClick={() => handlePrintDocument(d)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        Voir document
                      </button>
                    </div>
                    {d.commentaire && (
                      <p className="text-xs text-gray-500 mt-2 italic">Commentaire : {d.commentaire}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de visualisation du document */}
      {selectedDemande && (
        <DocumentModal
          demande={selectedDemande}
          profile={profile}
          onClose={() => setSelectedDemande(null)}
        />
      )}
    </div>
  );
}

function DocumentModal({ demande, profile, onClose }) {
  const documentRef = useRef(null);

  const handlePrint = () => {
    const content = documentRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Demande de récupération - ${demande.nom || profile?.nom} ${demande.prenom || profile?.prenom} - ${demande.date_travail_fr}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1a1a2e; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 2px; margin: 0; }
          .header p { font-size: 14px; color: #555; margin: 5px 0; }
          .separator { width: 100px; height: 2px; background: #555; margin: 15px auto; }
          .title { text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 30px 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .info-grid span { font-weight: bold; }
          .section { margin: 20px 0; padding-top: 15px; border-top: 1px solid #ddd; }
          .detail-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .checkbox-line { display: flex; align-items: center; gap: 8px; margin: 5px 0 5px 20px; }
          .checkbox { width: 14px; height: 14px; border: 2px solid #555; display: inline-block; text-align: center; line-height: 12px; font-size: 10px; }
          .checkbox.checked { background: #333; color: white; }
          .footer { display: flex; justify-content: space-between; margin-top: 40px; }
          .signature-area { text-align: center; }
          .signature-area img { max-width: 200px; max-height: 80px; }
          .stamp { margin-top: 30px; padding: 15px; border: 2px solid; text-align: center; font-weight: bold; }
          .stamp.validated { border-color: #16a34a; color: #16a34a; }
          .stamp.refused { border-color: #dc2626; color: #dc2626; }
          .disclaimer { font-size: 11px; font-style: italic; color: #777; margin: 20px 0; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Commune de Chartrettes</h1>
          <p>Service des Ressources Humaines</p>
          <div class="separator"></div>
        </div>
        <div class="title">
          Demande de ${demande.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération'} d'Heures Supplémentaires
        </div>
        <div class="info-grid">
          <div><span>Nom :</span> ${demande.nom || profile?.nom || ''}</div>
          <div><span>Prénom :</span> ${demande.prenom || profile?.prenom || ''}</div>
          <div><span>Service :</span> ${demande.service || profile?.service || 'Non renseigné'}</div>
          <div><span>Poste :</span> ${demande.poste || profile?.poste || 'Non renseigné'}</div>
        </div>
        <div class="section">
          <p>Je soussigné(e) <strong>${demande.prenom || profile?.prenom || ''} ${demande.nom || profile?.nom || ''}</strong>,
          déclare avoir effectué des heures de travail supplémentaires dans les conditions suivantes :</p>
          <div class="detail-box">
            <p><strong>Date du travail supplémentaire :</strong> ${demande.date_travail_fr}</p>
            <p><strong>Nombre d'heures effectuées :</strong> ${demande.nombre_heures} heure(s)</p>
            <p><strong>Nature du travail :</strong> ${demande.raison}</p>
          </div>
        </div>
        <div class="section">
          <p><strong>Compensation demandée :</strong></p>
          <div class="checkbox-line">
            <span class="checkbox ${demande.type_compensation === 'recuperation' ? 'checked' : ''}">${demande.type_compensation === 'recuperation' ? 'X' : ''}</span>
            <span>Récupération en jours de congé</span>
          </div>
          <div class="checkbox-line">
            <span class="checkbox ${demande.type_compensation === 'remuneration' ? 'checked' : ''}">${demande.type_compensation === 'remuneration' ? 'X' : ''}</span>
            <span>Rémunération des heures supplémentaires</span>
          </div>
        </div>
        <p class="disclaimer">En signant ce document, je certifie sur l'honneur l'exactitude des informations ci-dessus
        et demande le traitement de ma requête conformément à la réglementation en vigueur.</p>
        <div class="footer">
          <div>
            <p><strong>Fait à Chartrettes,</strong></p>
            <p>Le ${demande.date_demande_fr}</p>
          </div>
          <div class="signature-area">
            <p><strong>Signature de l'agent</strong></p>
            ${demande.signature ? `<img src="${demande.signature}" alt="Signature" />` : '<div style="width:200px;height:1px;background:#555;margin-top:40px"></div>'}
          </div>
        </div>
        ${demande.statut !== 'en_attente' ? `
          <div class="stamp ${demande.statut === 'validee' ? 'validated' : 'refused'}">
            ${demande.statut === 'validee' ? 'VALIDEE' : 'REFUSEE'}
            ${demande.date_validation_fr ? ` - Le ${demande.date_validation_fr}` : ''}
            ${demande.validateur_prenom ? ` - Par ${demande.validateur_prenom} ${demande.validateur_nom}` : ''}
          </div>
        ` : ''}
        ${demande.commentaire ? `<p style="margin-top:15px;font-style:italic;color:#555"><strong>Commentaire :</strong> ${demande.commentaire}</p>` : ''}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Document officiel</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              Imprimer / PDF
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div ref={documentRef} className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
              Commune de Chartrettes
            </h3>
            <p className="text-sm text-gray-600 mt-1">Service des Ressources Humaines</p>
            <div className="w-24 h-0.5 bg-gray-400 mx-auto mt-3"></div>
          </div>

          <h4 className="text-center text-base font-bold text-gray-800 mb-6 uppercase">
            Demande de {demande.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération'} d'Heures Supplémentaires
          </h4>

          <div className="grid grid-cols-2 gap-2 bg-gray-50 p-4 rounded-lg text-sm mb-4">
            <p><span className="font-semibold">Nom :</span> {demande.nom || profile?.nom}</p>
            <p><span className="font-semibold">Prénom :</span> {demande.prenom || profile?.prenom}</p>
            <p><span className="font-semibold">Service :</span> {demande.service || profile?.service || 'Non renseigné'}</p>
            <p><span className="font-semibold">Poste :</span> {demande.poste || profile?.poste || 'Non renseigné'}</p>
          </div>

          <div className="border-t border-gray-200 pt-4 text-sm space-y-3">
            <p>
              Je soussigné(e) <strong>{demande.prenom || profile?.prenom} {demande.nom || profile?.nom}</strong>,
              déclare avoir effectué des heures de travail supplémentaires :
            </p>
            <div className="bg-gray-50 p-4 rounded-lg space-y-1">
              <p><strong>Date :</strong> {demande.date_travail_fr}</p>
              <p><strong>Heures :</strong> {demande.nombre_heures}h</p>
              <p><strong>Nature :</strong> {demande.raison}</p>
            </div>
            <p>
              <strong>Compensation :</strong>{' '}
              {demande.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération en congé'}
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4 flex justify-between items-end text-sm">
            <div>
              <p className="font-semibold">Fait à Chartrettes,</p>
              <p>Le {demande.date_demande_fr}</p>
            </div>
            <div className="text-center">
              <p className="font-semibold mb-1">Signature</p>
              {demande.signature && (
                <img src={demande.signature} alt="Signature" className="max-w-[180px] max-h-[70px]" />
              )}
            </div>
          </div>

          {demande.statut !== 'en_attente' && (
            <div className={`mt-6 p-3 border-2 rounded-lg text-center font-bold ${
              demande.statut === 'validee'
                ? 'border-green-500 text-green-600'
                : 'border-red-500 text-red-600'
            }`}>
              {demande.statut === 'validee' ? 'VALIDEE' : 'REFUSEE'}
              {demande.date_validation_fr && ` - Le ${demande.date_validation_fr}`}
              {demande.validateur_prenom && ` - Par ${demande.validateur_prenom} ${demande.validateur_nom}`}
            </div>
          )}

          {demande.commentaire && (
            <p className="mt-3 text-sm italic text-gray-600">
              <strong>Commentaire :</strong> {demande.commentaire}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
