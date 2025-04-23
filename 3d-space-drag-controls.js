function activateDrag(x, y, z, lenght, height, width, limitX, limitY, limitZ, dotNetHelper) {

    const space3D = document.querySelector('#scatola')
    const refCamera = document.querySelector('#TruckCamera');
    const Ascene = document.querySelector('#aframeScene');
    Ascene.add(space3D);
    //object3D serve a rendere un oggetto AFRAME in un oggetto THREE.js utile qui perché drag funziona solo con THREE.js
    renderer = Ascene.renderer;
    const box3d = space3D.object3D;
    // per trovare effettivamente la telecamera dato che l'assocciava a un group (Misto tra Aframe e THREE.js)
    let actualCamera = null;
    refCamera.object3D.traverse((child) => {
        if (child.isCamera) {
            actualCamera = child;
        }
    });

    if (!actualCamera) {
        console.error("Nessuna telecamera trovata!");
        return;
    }

    // Configura il materiale per l'oggetto
    const material = new ATHREE.MeshStandardMaterial({ color: 'lightgray', emissive: 0x000000 });
    

    //// Materiale wireframe
    //const wireframe = new ATHREE.LineSegments(
    //    new THREE.EdgesGeometry(box3d.geometry),
    //    new THREE.LineBasicMaterial({
    //        color: 0x000000,
    //        linewidth: 1
    //    })
    //);
    //// Aggiungi il wireframe come figlio della mesh
    //box3d.add(wireframe);

    box3d.material = material;

    drag = new THREE.DragControls([box3d], actualCamera, renderer.domElement);
    // Funzione per abilitare/disabilitare il trascinamento
    function setDragEnabled(enabled) {
        isDragEnabled = enabled;
        if (!enabled) {
            // Disabilita il trascinamento
            drag.deactivate();
        } else {
            // Riabilita il trascinamento
            drag.activate();
        }
    }
    function setNewSpace(NLenght, NHeight, NWidth) {
        lenght = NLenght;
        height = NHeight;
        width = NWidth;
    }
    drag.addEventListener('dragstart', function (event) {
        if (!isDragEnabled) return;
        console.log('Trascinamento iniziato');
        disattivaTransform();
        refCamera.setAttribute('orbit-controls', 'enabled', false); // Disabilita OrbitControls durante il trascinamento
        event.object.material.emissive.set(0xaaaaaa); // Cambia il colore emissivo
    });

    drag.addEventListener('drag', function (event) {
        if (!isDragEnabled) return;
        disattivaTransform();
        const obj = event.object;
        if (obj.position.x < -x)
            obj.position.x = - x;
        else if (obj.position.x > limitX - lenght-x )
            obj.position.x = limitX - lenght-x;
        if (obj.position.y < -y)
            obj.position.y = -y;
        else if (obj.position.y > limitY - height- y)
            obj.position.y = limitY - height- y;
        if (obj.position.z < -z)
            obj.position.z = -z;
        else if(obj.position.z > limitZ - width-z)
            obj.position.z = limitZ - width-z;
        dotNetHelper.invokeMethodAsync("updateSpacePosition", obj.position.x+x, obj.position.y+y, obj.position.z+z); // Aggiorna la posizione in C#*/
    });

    // Gestisci la fine del trascinamento
    drag.addEventListener('dragend', function (event) {
        if (!isDragEnabled) return;
        console.log('Trascinamento finito');
        refCamera.setAttribute('orbit-controls', 'enabled', true); // Riabilita OrbitControls dopo il trascinamento
        event.object.material.emissive.set(0x000000); // Ripristina il colore emissivo
        const obj = event.object;
        if (obj.position.x < -x)
            obj.position.x = - x;
        else if (obj.position.x > limitX - lenght - x)
            obj.position.x = limitX - lenght - x;
        if (obj.position.y < -y)
            obj.position.y = -y;
        else if (obj.position.y > limitY - height - y)
            obj.position.y = limitY - height - y;
        if (obj.position.z < -z)
            obj.position.z = -z;
        else if (obj.position.z > limitZ - width - z)
            obj.position.z = limitZ - width - z;
        dotNetHelper.invokeMethodAsync("updateSpacePosition", obj.position.x+x, obj.position.y+y, obj.position.z+z);  // Funzione per aggiornare la posizione dello spazio*/
    });
    // Esponi la funzione per abilitare/disabilitare il trascinamento
    window.setDragEnabled = setDragEnabled;
    window.setNewSpace = setNewSpace;
}

function setDrag(enable) {
    if (window.setDragEnabled) 
        window.setDragEnabled(enable);
}

function setNewDimensions(length, height, width) {
    if (window.setNewSpace)
        window.setNewSpace(length, height, width) 
}
