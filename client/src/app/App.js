import React, { useState, useEffect } from 'react';
import { appointmentsApi, clientsApi, servicesApi, doctorsApi } from '../shared/api';
import { NavigationCards } from '../widgets/NavigationCards';
import { DoctorsPage } from '../pages/DoctorsPage';
import '../App.css';

// Временно импортируем функции из старого файла
import { 
  renderClients, 
  renderServices, 
  renderMaterials, 
  renderReports,
  renderHome 
} from './legacyComponents';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [appointmentsRes, clientsRes, servicesRes, doctorsRes] = await Promise.all([
        appointmentsApi.getAll(),
        clientsApi.getAll(),
        servicesApi.getAll(),
        doctorsApi.getAll()
      ]);
      setAppointments(appointmentsRes.data);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setDoctors(doctorsRes.data);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
  };

  return (
    <div className="App">
      <div className="app-header">
        <h1>🏥 Система управления клиникой</h1>
      </div>

      <div className="main-content">
        {currentView === 'home' && (
          <>
            <NavigationCards
              onNavigate={handleNavigate}
              clientsCount={clients.length}
              servicesCount={services.length}
              materialsCount={materials.length}
            />
            {/* TODO: Refactor renderHome to HomePage component */}
            {renderHome({
              appointments,
              clients,
              services,
              doctors,
              onNavigate: handleNavigate,
              onDataUpdate: loadData
            })}
          </>
        )}

        {currentView === 'doctors' && (
          <DoctorsPage onNavigate={handleNavigate} />
        )}

        {currentView === 'clients' && renderClients({ 
          clients, 
          onNavigate: handleNavigate,
          onDataUpdate: loadData 
        })}

        {currentView === 'services' && renderServices({ 
          services, 
          onNavigate: handleNavigate,
          onDataUpdate: loadData 
        })}

        {currentView === 'materials' && renderMaterials({ 
          materials, 
          onNavigate: handleNavigate,
          onDataUpdate: loadData 
        })}

        {currentView === 'reports' && renderReports({ 
          onNavigate: handleNavigate 
        })}
      </div>
    </div>
  );
}

export default App;

