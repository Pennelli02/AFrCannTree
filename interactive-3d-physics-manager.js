function DragRotateCollision(Tlenght, TWidth, THeight, ColliId, dotNetHelper) {
    const dotNet = dotNetHelper;
    const Ascene = document.querySelector('#aframeScene');
    const scene = Ascene.object3D;
    const camera = document.querySelector('#TruckCamera');
    let actualCamera;
    let selectedObject = null;
    let selectedBody = null;
    let isTransforming = false;
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const meshes = [];
    let lastPosition = new THREE.Vector3();
    let lastRotation = new THREE.Euler();
    let world, physicsMaterial;
    let initPhysics = false, activePhysics = false;
    let bodies = [];
    // Costanti per la gestione delle collisioni
    const COLLISION_TOLERANCE = -0.5;
    const STACKING_TOLERANCE = -1;

    // Mappa per memorizzare i bounding box degli oggetti
    const boundingBoxes = new Map();

    const physicsBodies = new Map(); // Mappa per associare mesh a corpi fisici

    // Nuove variabili per gestione gruppi
    let isGroupMode = false; // Modalità selezione gruppo
    const selectedObjects = []; // Array degli oggetti selezionati
    const selectedBodies = []; // Array dei corpi fisici selezionati
    let groupParent = null; // Oggetto container per il gruppo
    let groupBox = null; // Bounding box del gruppo

    // Trovare la camera effettiva
    camera.object3D.traverse((child) => {
        if (child.isCamera) {
            actualCamera = child;
        }
    });

    if (!actualCamera) {
        console.error("Nessuna telecamera trovata!");
        return;
    }

    const renderer = Ascene.renderer;

    // Creazione TransformControls
    const transformControls = new THREE.TransformControls(actualCamera, renderer.domElement);
    scene.add(transformControls);
    transformControls.setMode('translate');

    // Funzione per verificare se un oggetto è all'interno dei limiti
    function isWithinBounds(object) {
        const objectBox = new THREE.Box3().setFromObject(object).expandByScalar(-1);

        return (
            objectBox.min.x >= 0 && objectBox.max.x <= Tlenght &&
            objectBox.min.y >= 0 && objectBox.max.y <= THeight &&
            objectBox.min.z >= 0 && objectBox.max.z <= TWidth
        );
    }

    // Funzione per verificare se un oggetto è in collisione con altri
    function checkCollisions(object, ignoreList = []) {
        const collisions = [];

        for (const mesh of meshes) {
            if (mesh !== object && !ignoreList.includes(mesh)) {
                const objectBox = new THREE.Box3().setFromObject(object);
                const meshBox = new THREE.Box3().setFromObject(mesh);

                // Verifica sovrapposizione orizzontale (X e Z) con tolleranza
                const overlapX = !(objectBox.max.x < meshBox.min.x - COLLISION_TOLERANCE || objectBox.min.x > meshBox.max.x + COLLISION_TOLERANCE);
                const overlapZ = !(objectBox.max.z < meshBox.min.z - COLLISION_TOLERANCE || objectBox.min.z > meshBox.max.z + COLLISION_TOLERANCE);

                // Verifica sovrapposizione verticale (Y) con tolleranza
                const overlapY = !(objectBox.max.y < meshBox.min.y - STACKING_TOLERANCE || objectBox.min.y > meshBox.max.y + STACKING_TOLERANCE);

                // Se c'è sovrapposizione in tutte le direzioni, c'è una collisione
                if (overlapX && overlapZ && overlapY) {
                    collisions.push(mesh);
                }
            }
        }
        return collisions;
    }

    // Funzione per evidenziare l'oggetto selezionato
    function highlightObject(object, highlight = true, oneRemove = false) {
        if (object && object.material) {
            // Lavoriamo direttamente con l'oggetto
            if (highlight) {
                // Evidenzia
                object.material.emissive.set(0xaaaaaa);
            } else {
                // Ripristina il colore originale
                object.material.emissive.set(0x000000);
            }
            // Assicurati che il materiale sia aggiornato
            object.material.needsUpdate = true;
        }

        // Se l'oggetto ha figli, applica l'evidenziazione anche a loro
        if (!oneRemove && object.children && object.children.length > 0) {
            object.children.forEach(child => {
                highlightObject(child, highlight);
            });
        }
    }

    // Funzione per entrare/uscire dalla modalità gruppo
    function toggleGroupMode() {
        if (activePhysics) {
            togglePhysics();
        }
        console.log("GroupMode: " + isGroupMode);
        isGroupMode = !isGroupMode;

        // Deseleziona tutto prima di cambiare modalità
        if (selectedObject) {
            highlightObject(selectedObject, false);
            transformControls.detach();
            selectedObject = null;
        }

        // Pulisci la selezione di gruppo quando esci dalla modalità gruppo
        if (!isGroupMode) {
            clearGroupSelection();
        }

        console.log(`Modalità gruppo: ${isGroupMode ? "Attivata" : "Disattivata"}`);
    }

    // Funzione per creare/aggiornare il gruppo di selezione
    // Calcola il centro di un gruppo di oggetti
    function calculateGroupCenter() {
        if (selectedObjects.length === 0) return new THREE.Vector3();

        // Usa il bounding box per trovare il centro
        const groupBoundingBox = new THREE.Box3();

        selectedObjects.forEach(object => {
            groupBoundingBox.expandByObject(object);
        });

        const center = new THREE.Vector3();
        groupBoundingBox.getCenter(center);

        return center;
    }

    // Funzione per creare/aggiornare il gruppo di selezione - migliorata per centrare il gizmo
    function updateGroupSelection(index) {
        // Rimuovi il vecchio gruppo se esiste
        if (groupParent) {
            // Memorizza la posizione mondiale del gruppo prima di rimuoverlo
            const worldPosition = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();

            groupParent.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

            scene.remove(groupParent);

            // Ripristina gli oggetti nella scena
            selectedObjects.forEach(object => {
                // Mantieni la posizione mondiale degli oggetti
                object.updateMatrixWorld();
                const objectWorldPosition = new THREE.Vector3();
                const objectWorldQuaternion = new THREE.Quaternion();
                const objectWorldScale = new THREE.Vector3();

                object.matrixWorld.decompose(objectWorldPosition, objectWorldQuaternion, objectWorldScale);

                scene.add(object);

                // Applica la posizione mondiale all'oggetto
                object.position.copy(objectWorldPosition);
                object.quaternion.copy(objectWorldQuaternion);
                object.scale.copy(objectWorldScale);
            });
            if (index) {
                selectedObjects.splice(index, 1);
            }
        }

        // Crea un nuovo gruppo se ci sono oggetti selezionati
        if (selectedObjects.length > 0) {
            // Calcola il centro degli oggetti selezionati
            const groupCenter = calculateGroupCenter();

            groupParent = new THREE.Group();
            groupParent.name = "SelectionGroup";

            // Posiziona il gruppo al centro calcolato
            groupParent.position.copy(groupCenter);

            // Aggiungi il gruppo alla scena
            scene.add(groupParent);

            // Aggiungi tutti gli oggetti selezionati come figli del gruppo
            selectedObjects.forEach(object => {
                // Salva la posizione mondiale dell'oggetto
                object.updateMatrixWorld();
                const worldPosition = new THREE.Vector3();
                const worldQuaternion = new THREE.Quaternion();
                const worldScale = new THREE.Vector3();

                object.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

                // Aggiungi l'oggetto al gruppo
                groupParent.attach(object);

                // Mantieni l'aspetto visivo dell'oggetto
                highlightObject(object, true);
            });

            // Collega i controlli al gruppo
            transformControls.attach(groupParent);

            // Salva la posizione iniziale per il controllo delle collisioni
            lastPosition.copy(groupParent.position);
            lastRotation.copy(groupParent.rotation);

            // Calcola il bounding box complessivo del gruppo
            groupBox = new THREE.Box3().setFromObject(groupParent);
        } else {
            // Nessun oggetto selezionato
            groupParent = null;
            groupBox = null;
            transformControls.detach();
        }
    }

    // Funzione per pulire la selezione di gruppo
    // Funzione per pulire la selezione di gruppo
    function clearGroupSelection() {
        // Rimuovi l'evidenziazione da tutti gli oggetti
        selectedObjects.forEach(object => {
            highlightObject(object, false);
        });

        // Pulisci il gruppo
        if (groupParent) {
            // Mantieni la posizione mondiale degli oggetti quando li rimuovi dal gruppo
            selectedObjects.forEach(object => {
                object.updateMatrixWorld();
                const worldPosition = new THREE.Vector3();
                const worldQuaternion = new THREE.Quaternion();
                const worldScale = new THREE.Vector3();

                object.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

                scene.attach(object);

                // Ripristina la posizione mondiale
                object.position.copy(worldPosition);
                object.quaternion.copy(worldQuaternion);
                object.scale.copy(worldScale);
            });

            scene.remove(groupParent);
            groupParent = null;
            groupBox = null;
        }

        // Pulisci gli array
        selectedObjects.length = 0;
        selectedBodies.length = 0;

        // Scollega i controlli
        transformControls.detach();
    }

    // Funzione per aggiungere/rimuovere un oggetto dalla selezione di gruppo
    function toggleObjectInGroup(object) {
        // Controlla se l'oggetto è già nella selezione
        let index = selectedObjects.indexOf(object);
        if (index !== -1) {
            // Rimuovi l'oggetto dalla selezione

            highlightObject(object, false);





            // Se in modalità fisica, rimuovi anche il corpo fisico
            if (activePhysics) {
                const body = physicsBodies.get(object);
                if (body) {
                    const bodyIndex = selectedBodies.indexOf(body);
                    if (bodyIndex !== -1) {
                        selectedBodies.splice(bodyIndex, 1);
                    }
                }
            }
        } else {

            // Aggiungi l'oggetto alla selezione
            selectedObjects.push(object);
            highlightObject(object, true);

            // Se in modalità fisica, aggiungi anche il corpo fisico
            if (activePhysics) {
                const body = physicsBodies.get(object);
                if (body) {
                    selectedBodies.push(body);
                }
            }
            index = null;
        }

        // Aggiorna il gruppo
        updateGroupSelection(index);


    }

    // Funzione per gestire il click e la selezione degli oggetti
    function onPointerDown(event) {
        if (isTransforming) return;

        // Coordinate corrette per il container
        const rect = Ascene.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(pointer, actualCamera);

        // Cerca intersezioni solo con i mesh rilevanti
        const intersects = raycaster.intersectObjects(meshes, true);
        console.log("sono in grupping " + isGroupMode);
        if (intersects.length > 0) {
            // Trova l'oggetto padre che è nella lista meshes
            let targetMesh = intersects[0].object;
            while (targetMesh && !meshes.includes(targetMesh)) {
                targetMesh = targetMesh.parent;
            }
            /*targetMesh.material.emissive.set(0xaaaaaa)*/
            if (targetMesh) {
                if (isGroupMode) {
                    // Modalità gruppo: aggiungi/rimuovi dalla selezione
                    toggleObjectInGroup(targetMesh);
                } else {
                    // Modalità singola: deseleziona eventuale oggetto precedente
                    if (selectedObject) {
                        highlightObject(selectedObject, false);
                    }
                 
                    // Seleziona il nuovo oggetto
                    selectedObject = targetMesh;
                    dotNet.invokeMethodAsync("OnObjectSelected", targetMesh.userData.id);
                    // Evidenzia l'oggetto
                    highlightObject(selectedObject, true);

                    if (activePhysics) {
                        // Trova il corpo fisico corrispondente
                        selectedBody = physicsBodies.get(selectedObject);
                    }

                    // Memorizza la posizione e rotazione attuale
                    lastPosition.copy(selectedObject.position);
                    lastRotation.copy(selectedObject.rotation);

                    // Collega il TransformControls all'oggetto selezionato
                    transformControls.attach(selectedObject);
                }
            }
        } else {
            // Nessun oggetto selezionato - Clicco fuori
            if (!isGroupMode) {
                // In modalità singola, deseleziona l'oggetto corrente
                if (selectedObject) {
                    highlightObject(selectedObject, false);
                    transformControls.detach();
                    selectedObject = null;
                    dotNet.invokeMethodAsync("DeselectObject");
                }
            } else {
                // In modalità gruppo, se il gruppo è selezionato, deselezionalo
                if (groupParent && transformControls.object === groupParent) {
                    // se c'è un solo elemento selezionato pulisce tutto
                    if (selectedObjects.length === 1) {
                        clearGroupSelection();
                    }
                    transformControls.detach();
                }
                // Non pulisciamo la selezione così gli oggetti rimangono evidenziati solo se c'è uno solo selezionato
            }
        }
    }

    // Ciclo principale per l'aggiornamento
    Ascene.tick = function (time, timeDelta) {
        if (activePhysics) {
            // Aggiorna il mondo fisico
            world.step(1 / 60);

            // Sincronizza tutti gli oggetti tranne quello selezionato
            physicsBodies.forEach((body, mesh) => {
                // Aggiorna la mesh con la posizione del corpo fisico
                mesh.position.copy(body.position);
                mesh.quaternion.copy(body.quaternion);
            });
            // uses for debug about physic
            /*createDebugVisuals();*/
        }
    };

    // Event listeners
    window.addEventListener('mousedown', onPointerDown);

    // Cambia modalità con i tasti
    function keydownHandler(event) {
        switch (event.key) {
            case 'g': // translate (grab)
                transformControls.setMode('translate');
                break;
            case 'r': // rotate
                if (!isGroupMode) // non si può attivare la rotazione in modalità raggruppamento
                    transformControls.setMode('rotate');
                break;
            case 's': // deseleziona
                if (isGroupMode) {
                    clearGroupSelection();
                } else if (selectedObject) {
                    highlightObject(selectedObject, false);
                    transformControls.detach();
                    selectedObject = null;
                }
                break;
            case 't': // attiva la fisica
                togglePhysics();
                break;
            case 'm': // toggle group mode
                transformControls.setMode('translate'); // così non potrà mai esserci una rotazione durante il raggruppamento
                toggleGroupMode();
                break;
        }
    }
    window.addEventListener('keydown', keydownHandler);

    // Gestione del trascinamento
    transformControls.addEventListener('dragging-changed', function (event) {
        // Disabilita i controlli orbitali durante il trascinamento
        if (camera.hasAttribute('orbit-controls')) {
            camera.setAttribute('orbit-controls', 'enabled', !event.value);
        }

        isTransforming = event.value;

        if (event.value) {
            // Trascinamento iniziato
            if (isGroupMode && groupParent) {
                // In modalità gruppo, memorizza la posizione del gruppo
                lastPosition.copy(groupParent.position);
                lastRotation.copy(groupParent.rotation);
            } else if (selectedObject) {
                // In modalità singola, memorizza la posizione dell'oggetto
                lastPosition.copy(selectedObject.position);
                lastRotation.copy(selectedObject.rotation);
            }

            if (activePhysics) {
                world.gravity.set(0, 0, 0);
            }
        } else {
            // Trascinamento finito
            if (activePhysics) {
                world.gravity.set(0, -9.8, 0);
            }
            // se richiesto aggiornare la posizione su C# sia per la modalità gruppo che selezione singola
        }
    });

    // Aggiorna la mesh quando viene spostata o ruotata
    transformControls.addEventListener('objectChange', function () {
        if (isGroupMode && groupParent) {
            // Verifica limiti e collisioni per il gruppo

            // Aggiorna il bounding box del gruppo
            groupBox = new THREE.Box3().setFromObject(groupParent);

            // Controlla se il gruppo è all'interno dei limiti
            const groupWithinBounds = (
                groupBox.min.x >= 0 && groupBox.max.x <= Tlenght &&
                groupBox.min.y >= 0 && groupBox.max.y <= THeight &&
                groupBox.min.z >= 0 && groupBox.max.z <= TWidth
            );

            if (!groupWithinBounds) {
                // Applica gli aggiustamenti per rimanere nei limiti
                const adjustX = groupBox.min.x < 0 ? -groupBox.min.x :
                    groupBox.max.x > Tlenght ? Tlenght - groupBox.max.x : 0;

                const adjustY = groupBox.min.y < 0 ? -groupBox.min.y :
                    groupBox.max.y > THeight ? THeight - groupBox.max.y : 0;

                const adjustZ = groupBox.min.z < 0 ? -groupBox.min.z :
                    groupBox.max.z > TWidth ? TWidth - groupBox.max.z : 0;

                // Applica gli aggiustamenti al gruppo
                groupParent.position.x += adjustX;
                groupParent.position.y += adjustY;
                groupParent.position.z += adjustZ;

                // Aggiorna il bounding box dopo l'aggiustamento
                groupBox = new THREE.Box3().setFromObject(groupParent);
            }

            // Controlla collisioni con oggetti non nel gruppo
            let groupCollision = false;

            // Per ogni oggetto nel gruppo, verifica le collisioni con gli oggetti non nel gruppo
            for (const object of selectedObjects) {
                const collisions = checkCollisions(object, selectedObjects);

                if (collisions.length > 0) {
                    groupCollision = true;
                    console.log("Collisione rilevata per l'oggetto:", object.userData.id, "con",
                        collisions.map(mesh => mesh.userData.id).join(", "));
                    break;
                }
            }

            if (groupCollision) {
                // Collisione rilevata, ripristina la posizione e rotazione precedente
                groupParent.position.copy(lastPosition);
                groupParent.rotation.copy(lastRotation);
            } else {
                // Nessuna collisione, aggiorna la posizione e rotazione precedente
                lastPosition.copy(groupParent.position);
                lastRotation.copy(groupParent.rotation);
            }

            // Aggiorna i corpi fisici se la fisica è attiva
            if (activePhysics) {
                selectedObjects.forEach((object, index) => {
                    const body = physicsBodies.get(object);
                    if (body) {
                        body.position.copy(object.position);
                        body.quaternion.copy(object.quaternion);
                    }
                });
            }
        } else if (selectedObject) {
            // Gestione per un singolo oggetto selezionato
            // Aggiorna il bounding box dell'oggetto
            const objectBox = new THREE.Box3().setFromObject(selectedObject);

            // Aggiorna le dimensioni correnti dell'oggetto
            //selectedObject.userData.bbwidth = objectBox.getSize(new THREE.Vector3()).z ;
            //selectedObject.userData.bbheight = objectBox.getSize(new THREE.Vector3()).y ;
            //selectedObject.userData.bblength = objectBox.getSize(new THREE.Vector3()).x ;

            // Controlla se l'oggetto è all'interno dei limiti
            if (!isWithinBounds(selectedObject)) {
                // Applica gli aggiustamenti per rimanere nei limiti
                const adjustX = objectBox.min.x < 0 ? -objectBox.min.x :
                    objectBox.max.x > Tlenght ? Tlenght - objectBox.max.x : 0;

                const adjustY = objectBox.min.y < 0 ? -objectBox.min.y :
                    objectBox.max.y > THeight ? THeight - objectBox.max.y : 0;

                const adjustZ = objectBox.min.z < 0 ? -objectBox.min.z :
                    objectBox.max.z > TWidth ? TWidth - objectBox.max.z : 0;

                // Applica gli aggiustamenti
                selectedObject.position.x += adjustX;
                selectedObject.position.y += adjustY;
                selectedObject.position.z += adjustZ;
            }

            // Controlla collisioni con altri oggetti
            const collisions = checkCollisions(selectedObject);

            if (collisions.length > 0) {
                // Collisione rilevata, ripristina la posizione e rotazione precedente
                selectedObject.position.copy(lastPosition);
                selectedObject.rotation.copy(lastRotation);

                console.log("Collisione rilevata tra:", selectedObject.userData.id, "e",
                    collisions.map(mesh => mesh.userData.id).join(", "));
            } else {
                // Nessuna collisione, aggiorna la posizione e rotazione precedente
                lastPosition.copy(selectedObject.position);
                lastRotation.copy(selectedObject.rotation);

                // Aggiorna il bounding box originale
                boundingBoxes.set(selectedObject, new THREE.Box3().setFromObject(selectedObject));
            }

            if (activePhysics && selectedBody) {
                selectedBody.position.copy(selectedObject.position);
                selectedBody.quaternion.copy(selectedObject.quaternion);
            }
        }
    });

    // Funzione per controllare la stabilità degli oggetti impilati
    function checkStability() {
        const unstableObjects = [];

        // Controlla ogni oggetto eccetto quelli appoggiati direttamente sul pavimento
        for (const mesh of meshes) {
            const meshBox = new THREE.Box3().setFromObject(mesh);

            // Se l'oggetto è appoggiato sul pavimento, è stabile
            if (meshBox.min.y < STACKING_TOLERANCE) {
                continue;
            }

            // Verifica se l'oggetto è supportato da un altro oggetto
            let isSupported = false;
            for (const supportMesh of meshes) {
                if (supportMesh !== mesh && isObjectOnTop(mesh, supportMesh)) {
                    isSupported = true;
                    break;
                }
            }

            if (!isSupported) {
                unstableObjects.push(mesh);
            }
        }

        return unstableObjects;
    }

    // Funzione per verificare se un oggetto è impilato su un altro
    function isObjectOnTop(upperMesh, lowerMesh) {
        const upperBox = new THREE.Box3().setFromObject(upperMesh);
        const lowerBox = new THREE.Box3().setFromObject(lowerMesh);

        // Verifica la sovrapposizione orizzontale
        const overlapX = !(upperBox.max.x < lowerBox.min.x || upperBox.min.x > lowerBox.max.x);
        const overlapZ = !(upperBox.max.z < lowerBox.min.z || upperBox.min.z > lowerBox.max.z);

        // Verifica che l'oggetto superiore sia appoggiato su quello inferiore
        const isOnTop = Math.abs(upperBox.min.y - lowerBox.max.y) < STACKING_TOLERANCE;

        return overlapX && overlapZ && isOnTop;
    }

    // Crea oggetti per tutti i colli
    ColliId.forEach(id => {
        const mesh = createObject(
            id
        );

        if (mesh) {
            // Crea un bounding box per la mesh
            const boundingBox = new THREE.Box3().setFromObject(mesh);
            boundingBoxes.set(mesh, boundingBox);

            // Aggiungi alla lista
            meshes.push(mesh);
        }
    });

    // Funzione per creare gli oggetti
    function createObject(id) {
        // Trova l'oggetto A-Frame
        const collo = document.querySelector(id);
        if (!collo) {
            console.error(`Oggetto ${id} non trovato!`);
            return null;
        }
        const color = collo.getAttribute('color');
        const height = parseFloat(collo.getAttribute('height'));
        const shape = collo.getAttribute('geometry').primitive;

        // Recupera l'oggetto Three.js
        const mesh = collo.object3D;
        //modifico il materiale in modo da permettere che si illumini alla selezione
        const material = new ATHREE.MeshStandardMaterial({ color: color, emissive: 0x000000 });
        mesh.material = material;
        //salvare il tipo di rotazione
        const Rotation = {
            x: mesh.rotation.x,
            y: mesh.rotation.y,
            z: mesh.rotation.z
        };
        if (Rotation.x === 0 && Rotation.y === 0 && Rotation.z === 0) {
            mesh.userData.type = "yaw";
        } else if (Rotation.x === 0 && Rotation.y === 0 && Rotation.z === 90)
            mesh.userData.type = "pitch";
        else {
            mesh.userData.type = "roll";
        }
        // Memorizza le dimensioni e la forma
        mesh.userData.id = id;
        mesh.userData.Shape = shape;
        mesh.userData.color = color;

        if (shape === 'box') {
            const width = parseFloat(collo.getAttribute('depth'));
            const length = parseFloat(collo.getAttribute('width'));
            mesh.userData.width = width;
            mesh.userData.height = height;
            mesh.userData.length = length;
        } else if (shape === 'cylinder') {
            mesh.userData.height = height;
            const radius = parseFloat(collo.getAttribute('radius'));
            mesh.userData.radius = radius;
            mesh.userData.width = radius;
            mesh.userData.length = radius;
        }
        // Posizione iniziale (centrata correttamente)
        //mesh.position.set(
        //    x + length / 2,
        //    y + height / 2,
        //    z + width / 2
        //);

        console.log(`Creato oggetto: #collo_${id} a posizione`, mesh.position);

        return mesh;
    }
    // funzione per dispose
    window.resetFunction = function () {
            console.log("Trying to call reset...");

            // Rimuovi gli event listener
            window.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('keydown', keydownHandler);

            // Ferma la fisica se attiva
            if (world) {
                // Rimuovi tutti i corpi dal mondo fisico
                bodies.forEach(body => {
                    world.removeBody(body);
                });
                world = null;
            }

            // Pulisci le mappe e gli array
            if (physicsBodies) {
                physicsBodies.clear();
            }
            bodies.length = 0;
            meshes.length = 0;

            // Rimuovi i controlli di trasformazione
            if (transformControls) {
                transformControls.detach();
                scene.remove(transformControls);
            }

            // Resetta le variabili di stato
            selectedObject = null;
            selectedBody = null;
            isTransforming = false;
            isGroupMode = false;
            initPhysics = false;
            activePhysics = false;

            // Pulisci la selezione di gruppo
            clearGroupSelection();

            // Rimuovi eventuali debug visuals
            const existingDebug = scene.getObjectByName("physics_debug_group");
            if (existingDebug) {
                scene.remove(existingDebug);
            }

            // Rimuovi il tick handler personalizzato
            if (Ascene && Ascene.tick) {
                delete Ascene.tick;
            }

            // Rimuovi la funzione di reset dal window object
            if (window.resetFunction) {
                delete window.resetFunction;
            }

            console.log("Reset completed successfully");
        
    };
    function togglePhysics()
    {
        if (isGroupMode) {
            toggleGroupMode();
        }
        if (!initPhysics) {
            world = new CANNON.World();
            world.gravity.set(0, -9.8, 0);
            // Imposta un numero massimo di iterazioni per il mondo fisico
            world.solver.iterations = 7;
            // Usa un solver più leggero
            world.solver = new CANNON.GSSolver();
            //// Imposta una tolleranza di riposo
            //world.allowSleep = true;

            physicsMaterial = new CANNON.Material();
            const contactMaterial = new CANNON.ContactMaterial(physicsMaterial, {
                friction: 0.3,     // Attrito ridotto
                restitution: 0   // Rimbalzo molto basso           
            });
            world.addContactMaterial(contactMaterial);

            // Piano fisico (rimane uguale)
            const groundShape = new CANNON.Plane();
            const groundBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
            groundBody.addShape(groundShape);
            groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
            world.addBody(groundBody);

            // Parametri modificati
            const wallThickness = 0.2; // Aumentato lo spessore per evitare passaggi
            const halfThickness = wallThickness / 2;

            // Parete frontale (z = 0)
            const frontWallShape = new CANNON.Box(new CANNON.Vec3(Tlenght / 2, THeight / 2, halfThickness));
            const frontWallBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
            frontWallBody.addShape(frontWallShape);
            frontWallBody.position.set(Tlenght / 2, THeight / 2, -halfThickness); // Posizionata a z=0 + metà spessore
            world.addBody(frontWallBody);

            // Parete posteriore (z = TWidth)
            const backWallShape = new CANNON.Box(new CANNON.Vec3(Tlenght / 2, THeight / 2, halfThickness));
            const backWallBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
            backWallBody.addShape(backWallShape);
            backWallBody.position.set(Tlenght / 2, THeight / 2, TWidth + halfThickness); // Posizionata a z=TWidth - metà spessore
            world.addBody(backWallBody);

            // Parete sinistra (x = 0)
            const leftWallShape = new CANNON.Box(new CANNON.Vec3(halfThickness, THeight / 2, TWidth / 2));
            const leftWallBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
            leftWallBody.addShape(leftWallShape);
            leftWallBody.position.set(-halfThickness, THeight / 2, TWidth / 2); // Posizionata a x=0 + metà spessore
            world.addBody(leftWallBody);

            // Parete destra (x = Tlenght)
            const rightWallShape = new CANNON.Box(new CANNON.Vec3(halfThickness, THeight / 2, TWidth / 2));
            const rightWallBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
            rightWallBody.addShape(rightWallShape);
            rightWallBody.position.set(Tlenght + halfThickness, THeight / 2, TWidth / 2); // Posizionata a x=Tlenght - metà spessore
            world.addBody(rightWallBody);
            //// soffitto certe volte gli oggetti si conficcano
            //const ceilingShape = new CANNON.Box(new CANNON.Vec3(Tlenght / 2, halfThickness, TWidth / 2));
            //const ceilingBody = new CANNON.Body({
            //    mass: 0,
            //    material: physicsMaterial,
            //    position: new CANNON.Vec3(Tlenght / 2, THeight + halfThickness, TWidth / 2)
            //});
            /*ceilingBody.addShape(ceilingShape);*/
            /*world.addBody(ceilingBody);*/
            meshes.forEach(mesh => {
                const { body } = createPhysicsObject(
                    mesh
                );

                // Associa il body alla mesh usando la mappa
                physicsBodies.set(mesh, body);
                
                // Aggiungi alla lista
                bodies.push(body);

            });
            initPhysics = true;
            activePhysics = true;
        } else {
            if (activePhysics) {
                world.gravity.set(0, 0, 0);
                activePhysics = false;
            } else {
                physicsBodies.forEach((body, mesh) => {
                    // Aggiorna la mesh con la posizione del corpo fisico
                    body.position.copy(mesh.position);
                    body.quaternion.copy(mesh.quaternion);

                }); // ogni volta che la fisica viene riattivata va riallineato il body con la mesh
                activePhysics = true;
                world.gravity.set(0, -9.8, 0);

            }
        }

    }

    // Funzione per settare i corpi fisici
    function createPhysicsObject(meshFromList) {
        // Trova l'oggetto A-Frame
        //const collo = document.querySelector(`#collo_${id}`);
        //if (!collo) {
        //    console.error(`Oggetto #collo_${id} non trovato!`);
        //    return { body: null, mesh: null };
        //}

        // Recupera l'oggetto Three.js
        /*const meshFromList = meshes.find(m => m.userData.id === id);*/
        let shape;

        if (meshFromList.userData.Shape === 'cylinder') {
            // Per un cilindro, usiamo il raggio e l'altezza
            // Il radius è metà del diametro (può essere width o length, a seconda dell'orientamento)
            /*const radius = Math.max(width, length) / 2;*/
            // Crea un cilindro con l'asse Y verticale questo non rimarrà di default ma lo sceglie l'utente
            /*shape = new CANNON.Cylinder(radius, radius, height, 16);*/ // 16 segmenti per approssimare il cerchio

            // Creazione della rotazione
            const rotationFix = new CANNON.Quaternion();
            rotationFix.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); // Rotazione di 90° attorno a X

            let quat = new CANNON.Quaternion();

            const radius = meshFromList.userData.radius;
            shape = new CANNON.Cylinder(radius , radius , meshFromList.userData.height, 20);
            if (meshFromList.userData.type === "yaw") {
                /*shape = new CANNON.Cylinder(radius + 0.01, radius+ 0.01, meshFromList.userData.height, 16);*/
                // Se deve ruotare attorno a Y di 90°
                const yawQuat = new CANNON.Quaternion();
                /*yawQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2); // Ruota di 90° attorno a Y*/
                quat = yawQuat.mult(rotationFix);
            }
            else if (meshFromList.userData.type === "pitch") {
                
                /*shape = new CANNON.Cylinder(radius + 0.1, radius + 0.1, meshFromList.userData.height, 16);*/
                // Se deve ruotare attorno a X di 90°
                const rollQuat = new CANNON.Quaternion();
                /*rollQuat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); // Ruota di 90° attorno a X*/
                quat = rollQuat.mult(rotationFix);
            }
            else if (meshFromList.userData.type === "roll") {
                
                // Se deve ruotare attorno a Z di 90°
                const pitchQuat = new CANNON.Quaternion();
                /*pitchQuat.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2); // Ruota di 90° attorno a Z*/
                quat = pitchQuat.mult(rotationFix);
            }


            // Applica la trasformazione
            shape.transformAllPoints(new CANNON.Vec3(0,0,0), quat);

        } else {
            // Per una scatola, usiamo il metodo originale
            shape = new CANNON.Box(new CANNON.Vec3(meshFromList.userData.length / 2 + 0.01, meshFromList.userData.height / 2 + 0.01, meshFromList.userData.width / 2 + 0.01));
        }
        const body = new CANNON.Body({
            mass: 10,  // Massa iniziale
            material: physicsMaterial,
            restitution: 0,  // Minimo rimbalzo
            friction: 0.8,     // Attrito moderato
            linearDamping: 0.99,
            angularDamping: 0.99
        });

        body.addShape(shape);
        //body.linearDamping = 0.99;  // Smorzamento lineare
        //body.angularDamping = 0.99; // Smorzamento angolare

        // Posizione iniziale (centrata correttamente)
        body.position.set(
            meshFromList.position.x,
            meshFromList.position.y ,
            meshFromList.position.z 
        );

        body.position.copy(meshFromList.position);
        // Copy the mesh's current rotation to the physics body
        const euler = new THREE.Euler().copy(meshFromList.rotation);
        const quaternion = new THREE.Quaternion().setFromEuler(euler);
        body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
        // Aggiungi il corpo al mondo fisico
        world.addBody(body);

        console.log(`Creato oggetto fisico: #collo_${id} a posizione`, body.position);

        return { body };
    }

    //Add this function to your codebase only for debug not necessary
    function createDebugVisuals() {
        // Rimuovi eventuali debug visuals esistenti
        const existingDebug = scene.getObjectByName("physics_debug_group");
        if (existingDebug) scene.remove(existingDebug);

        // Crea un nuovo gruppo per i debug visuals
        const debugGroup = new THREE.Group();
        debugGroup.name = "physics_debug_group";
        scene.add(debugGroup);

        // Crea wireframe visualizations per ogni corpo fisico
        physicsBodies.forEach((body, mesh) => {
            body.shapes.forEach((shape, i) => {
                let geometry;
                let wireframe;

                // Ottieni l'offset e l'orientamento della forma rispetto al corpo
                const shapeOffset = body.shapeOffsets[i] || new CANNON.Vec3();
                const shapeQuat = body.shapeOrientations[i] || new CANNON.Quaternion();

                if (shape.type === CANNON.Shape.types.BOX) {
                    // Crea un wireframe per una scatola
                    const halfExtents = shape.halfExtents;
                    geometry = new THREE.BoxGeometry(
                        halfExtents.x * 2,
                        halfExtents.y * 2,
                        halfExtents.z * 2
                    );
                    wireframe = new THREE.WireframeGeometry(geometry);
                } else if (shape.type === CANNON.Shape.types.CONVEXPOLYHEDRON) {
                    // Opzione 1: Bounding Box (Scatola)
                    const boundingBox = new THREE.Box3();
                    const vertices = shape.vertices.map(v => new THREE.Vector3(v.x, v.y, v.z));
                    vertices.forEach(v => boundingBox.expandByPoint(v));

                    const boxSize = new THREE.Vector3();
                    boundingBox.getSize(boxSize);

                    //geometry = new THREE.BoxGeometry(boxSize.x, boxSize.y, boxSize.z);
                    //wireframe = new THREE.WireframeGeometry(geometry);

                    // Opzione 2: Cilindro (commenta la BoxGeometry sopra per usare questa)
                    
                    const radius = Math.max(boxSize.x, boxSize.z) / 2; // Approssimazione del raggio
                    const height = boxSize.y; // Altezza basata sull'asse Y del bounding box
                    geometry = new THREE.CylinderGeometry(radius, radius, height, 12);
                    wireframe = new THREE.WireframeGeometry(geometry);
                    
                }

                if (wireframe) {
                    const line = new THREE.LineSegments(
                        wireframe,
                        new THREE.LineBasicMaterial({ color: 0xff0000 })
                    );

                    // Posizione e orientamento secondo il corpo
                    line.position.copy(body.position);
                    line.quaternion.copy(body.quaternion);

                    // Applica l'offset e l'orientamento della forma
                    const offsetPosition = new THREE.Vector3(shapeOffset.x, shapeOffset.y, shapeOffset.z);
                    offsetPosition.applyQuaternion(line.quaternion);
                    line.position.add(offsetPosition);

                    const shapeQuaternionThree = new THREE.Quaternion(
                        shapeQuat.x, shapeQuat.y, shapeQuat.z, shapeQuat.w
                    );
                    line.quaternion.multiply(shapeQuaternionThree);

                    debugGroup.add(line);
                }
            });
        });
    }


    // Esponi alcune funzioni utili
    return {
        meshes,
        resetPositions: function () {
            // Resetta le posizioni degli oggetti
            colliInTrack.forEach(collo => {
                const mesh = meshes.find(m => m.userData.id === collo.id);
                if (mesh) {
                    mesh.position.set(
                        collo.position.x + collo.length / 2,
                        collo.position.y + collo.height / 2,
                        collo.position.z + collo.width / 2
                    );

                    // Resetta anche la rotazione
                    mesh.rotation.set(0, 0, 0);

                    // Aggiorna il bounding box
                    boundingBoxes.set(mesh, new THREE.Box3().setFromObject(mesh));
                }
            });
        },
        updateBoundingBoxes: function () {
            // Aggiorna tutti i bounding box
            meshes.forEach(mesh => {
                boundingBoxes.set(mesh, new THREE.Box3().setFromObject(mesh));
            });
        },
        checkAllCollisions: function () {
            // Controlla tutte le collisioni possibili
            const collisions = [];
            for (let i = 0; i < meshes.length; i++) {
                for (let j = i + 1; j < meshes.length; j++) {
                    const meshI = meshes[i];
                    const meshJ = meshes[j];

                    // Ignora le collisioni se un oggetto è impilato sull'altro
                    if (isObjectOnTop(meshI, meshJ) || isObjectOnTop(meshJ, meshI)) {
                        continue;
                    }

                    // Controlla la collisione
                    const meshIBox = new THREE.Box3().setFromObject(meshI);
                    const meshJBox = new THREE.Box3().setFromObject(meshJ);

                    if (meshIBox.intersectsBox(meshJBox)) {
                        collisions.push({
                            object1: meshI.userData.id,
                            object2: meshJ.userData.id
                        });
                    }
                }
            }
            return collisions;
        },
        checkStability: checkStability,
        getStackingInfo: function () {
            // Restituisce informazioni sugli oggetti impilati
            const stackedObjects = [];

            for (const mesh of meshes) {
                const supportingObjects = [];

                for (const supportMesh of meshes) {
                    if (supportMesh !== mesh && isObjectOnTop(mesh, supportMesh)) {
                        supportingObjects.push(supportMesh.userData.id);
                    }
                }

                if (supportingObjects.length > 0) {
                    stackedObjects.push({
                        id: mesh.userData.id,
                        supportedBy: supportingObjects
                    });
                }
            }

            return stackedObjects;
        },


        toggleGroupMode: function () {
            toggleGroupMode();
        },
        togglePhysics: function () {
            togglePhysics();
        }
    };
}


function resetAfterRender() {
    console.log("Trying to call reset...");
    console.log("window.reset exists?", typeof window.resetFunction !== 'undefined');
    if (window.resetFunction) {
        console.log("Calling reset now");
        window.resetFunction();
    } else {
        console.error("reset function not found on window object");
    }
}

function attivaModoGruppo() {
    const event = new KeyboardEvent('keydown', {
        key: 'm',  // 'm' è il tasto per toggleGroupMode 
        bubbles: true,
        cancelable: true
    });
    window.dispatchEvent(event);
}

function attivaFisica() {
    const event = new KeyboardEvent('keydown', {
        key: 't', // 't' è il tasto per la fisica
        bubbles: true, 
        cancelable: true
    });
    window.dispatchEvent(event);
}

function attivaTraslazione() {
    const event = new KeyboardEvent('keydown', {
        key: 'g', // 't' è il tasto per la fisica
        bubbles: true,
        cancelable: true
    });
    window.dispatchEvent(event);
}

function attivaRotazione() {
    const event = new KeyboardEvent('keydown', {
        key: 'r', // 't' è il tasto per la fisica
        bubbles: true,
        cancelable: true
    });
    window.dispatchEvent(event);
}
function disattivaTransform() {
    const event = new KeyboardEvent('keydown', {
        key: 's', // 's' è il tasto per la deselezione
        bubbles: true,
        cancelable: true
    });
    window.dispatchEvent(event);
}
