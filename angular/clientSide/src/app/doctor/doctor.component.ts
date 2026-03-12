import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { ModuloHttpService } from '../modulo-http.service';
import { Observable } from 'rxjs';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ServiceDatiService } from '../service-dati.service';

@Component({
  selector: 'doctor',
  imports: [DatePipe, UpperCasePipe],
  templateUrl: './doctor.component.html',
  styleUrl: './doctor.component.css'
})
export class DoctorComponent implements OnInit {
  currentOffset: number = 0;
  visite: any[] = [];
  
  settimanaLavorativa: any[][] = [[], [], [], [], []];// lunedì, martedì, mercoledì, giovedì, venerdì

  constructor(private http: ModuloHttpService, private servizio: ServiceDatiService) { }

  ngOnInit(): void {
    this.aggiornaDatiSettimana(0);
  }
  

 getWeekTimestamps(offsetSettimane: number = 0) {
  const oggi = new Date();
  const giornoSettimana = oggi.getDay();
  
  const diffLunedì = giornoSettimana === 0 ? -6 : 1 - giornoSettimana;
  
  const lunedi = new Date(oggi);
  lunedi.setDate(oggi.getDate() + diffLunedì + (offsetSettimane * 7));

  const venerdi = new Date(lunedi);
  venerdi.setDate(lunedi.getDate() + 4);

  const formattaData = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    lunedi: formattaData(lunedi),
    venerdi: formattaData(venerdi)
  };
}

  aggiornaDatiSettimana(offset: number) {
  this.currentOffset = offset;
  const { lunedi, venerdi } = this.getWeekTimestamps(this.currentOffset);
  
  this.http.getVisite(lunedi, venerdi).subscribe({
    next: (response: any) => { 
      
      if (response && response.data) {
        this.visite = response.data; 
      } else {
        this.visite = []; 
      }

      console.log("Visite ricevute:", this.visite);
      this.smistaVisite(); 
    },
    error: (err) => {
      console.error('Errore nel recupero delle visite:', err)
    }
  });
}

  smistaVisite() {

    if (!Array.isArray(this.visite)) {
    console.error("Attenzione: this.visite non è un array!", this.visite);
    return;
  }
    this.settimanaLavorativa = [[], [], [], [], []];

    this.visite.forEach(visita => {
      const data = new Date(visita.DataOrario);
      let giorno = data.getDay();      
      if (giorno >= 1 && giorno <= 5) {
        const indiceGiorno = giorno - 1; 
        this.settimanaLavorativa[indiceGiorno].push(visita);
      }
    });
    this.settimanaLavorativa.forEach(giorno => {
      giorno.sort((a, b) => new Date(a.DataOrario).getTime() - new Date(b.DataOrario).getTime());
    });
  }

  eventoSettimanaScorsa() {
    this.aggiornaDatiSettimana(this.currentOffset - 1);
  }

  eventoSettimanaProssima() {
    this.aggiornaDatiSettimana(this.currentOffset + 1);
  }


  logout()
  {   
    this.http.log_out().subscribe({
      next: (data)=>{
         console.log("Data ritornata dal logut: ",data)
         this.servizio.logOutDoctor()
      },
      error: (err) =>{
        console.log("Errore nel loguout: ", err)
      }
    })
    
  }
}