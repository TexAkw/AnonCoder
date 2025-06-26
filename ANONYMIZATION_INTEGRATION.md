# Intégration du Workflow d'Anonymisation dans Continue

Ce document décrit comment intégrer un workflow d'anonymisation dans l'extension Continue VSCode.

## Architecture

Le workflow d'anonymisation intercepte les messages avant qu'ils soient envoyés au LLM et affiche une popup de confirmation avec le texte anonymisé.

### Flux d'exécution

1. **Utilisateur saisit un message** → `ContinueInputBox.onEnter`
2. **Message intercepté** → Fonction `sendInput` dans `Chat.tsx`
3. **Appel du service d'anonymisation** → Proxy local (port 7002)
4. **Affichage de la popup** → `AnonymizationConfirmDialog`
5. **Confirmation utilisateur** → Message anonymisé envoyé au LLM
6. **Réponse du LLM** → Affichée normalement

## Fichiers créés et modifiés

### 1. Service Proxy d'Anonymisation (`custom_proxy/proxy.py`)

✅ **Complété** - Le proxy a été étendu avec :

- Endpoint `/v1/anonymize` pour l'anonymisation
- Fonction `anonymize_text()` qui détecte et remplace :
  - Adresses email
  - Numéros de téléphone
  - Noms potentiels
  - Adresses IP

### 2. Service d'Anonymisation Frontend (`gui/src/util/anonymization.ts`)

✅ **Complété** - Service TypeScript qui :

- Communique avec le proxy via fetch
- Gère les erreurs de connexion
- Type-safe avec interfaces TypeScript

### 3. Composant de Dialogue (`gui/src/components/dialogs/AnonymizationConfirmDialog.tsx`)

✅ **Complété** - Composant React qui :

- Affiche le texte original vs anonymisé
- Liste les changements détectés
- Boutons "Confirmer" et "Annuler"
- Design cohérent avec VSCode

### 4. Modification du Chat Principal (`gui/src/pages/gui/Chat.tsx`)

⚠️ **À terminer** - Les modifications incluent :

- Import du service d'anonymisation ✅
- Import du composant de dialogue ✅
- Modification de la fonction `sendInput` ⚠️ (erreurs d'imports à corriger)

### 3. Démarrer le service d'anonymisation

```bash
cd custom_proxy
python proxy.py
```

Le service sera disponible sur `http://localhost:7002`

### 4. Tester l'intégration

1. Démarrer Continue dans VSCode
2. Démarrer le proxy d'anonymisation
3. Taper un message contenant des informations sensibles (email, téléphone, nom)
4. Vérifier que la popup d'anonymisation apparaît
5. Confirmer et vérifier que le message anonymisé est envoyé

## Configuration

### Personnaliser les règles d'anonymisation

Modifier la fonction `anonymize_text()` dans `custom_proxy/proxy.py` :

```python
def anonymize_text(text: str) -> tuple[str, Dict[str, str]]:
    # Ajouter d'autres patterns :
    # - Numéros de sécurité sociale
    # - Adresses physiques
    # - Dates de naissance
    # - etc.
```

### Configurer l'URL du service

Modifier l'URL du service dans `gui/src/util/anonymization.ts` :

```typescript
constructor(baseUrl = 'http://localhost:7002') {
  this.baseUrl = baseUrl;
}
```

## Améliorations possibles

1. **Configuration dans VSCode** : Ajouter des settings pour activer/désactiver l'anonymisation
2. **Règles personnalisables** : Interface pour configurer les règles d'anonymisation
3. **Cache local** : Mémoriser les choix d'anonymisation pour éviter les popups répétées
4. **Logs d'audit** : Enregistrer les anonymisations pour la conformité
5. **Intégration avec des services tiers** : Utiliser des APIs d'anonymisation plus sophistiquées

## Dépannage

### Le service d'anonymisation ne répond pas

- Vérifier que `python proxy.py` est en cours d'exécution
- Vérifier les CORS et le port 7002

### Les imports TypeScript échouent

- Vérifier que tous les fichiers ont été créés
- Exécuter `npm install` si nécessaire

### La popup ne s'affiche pas

- Vérifier la console pour les erreurs JavaScript
- Vérifier que le composant `AnonymizationConfirmDialog` est bien importé
