import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Component } from '@angular/core';
@Injectable({
  providedIn: 'root'
})
export class ModuloHttpService { 
  
  constructor(private http: HttpClient) { }

   loginAsUser(user:any):Observable<any>{
    return this.http.post('http://localhost:3000/session/login/user', user, {withCredentials:true});
  }

   loginAsDoctor(user:any):Observable<any>{
    return this.http.post('http://localhost:3000/session/login/doctor', user, {withCredentials:true});
  }

   loginAsAdmin(user:any):Observable<any>{
    return this.http.post('http://localhost:3000/session/login/admin', user, {withCredentials:true}); // da verificare endpoint
  }

  getVisite(dateStart:string, dateEnd:string):Observable<any>{
    //dataInizio = this.toDatabaseDateTime(dataInizio);
    //dataFine = this.toDatabaseDateTime(dataFine);
    return this.http.get(`http://localhost:3000/db/private/visits/doctor?dateStart=${dateStart}&dateEnd=${dateEnd}`, {withCredentials:true});
  }

  getDottori():Observable<any> // id / nome / reparto
  {
    return this.http.get('http://localhost:3000/db/private/doctors', {withCredentials:true}) // chiedi a simo nome rotta giusta
  }

  getSpecializzazioni():Observable<any>
  {
    return this.http.get('http://localhost:3000/db/private/specs', {withCredentials:true})
  }

  getDottoriSpecializzazione(specName: string):Observable<any> // id / nome / reparto
  {
    return this.http.get(`http://localhost:3000/db/private/doctors/spec?specName=${specName}`, {withCredentials:true}) // chiedi a simo nome rotta giusta
  }

  getOrariDatoDottore(idDoctor:number, data:string):Observable<any>
  {
    return this.http.get(`http://localhost:3000/db/private/freeHours?docId=${idDoctor}&day=${data}`, {withCredentials:true}); // chiedi a simo nome rotta giusta
  }


  prenotaVisita(idDottore: number, data: string, ora: string): Observable<any> {
  const payload = { idDottore, data, ora }; 
  return this.http.post('http://localhost:3000/db/private/newVisit', payload, {withCredentials:true}); // chiedi a simo nome rotta giusta
  }

  getAllVisiteDottore(idDottore: number): Observable<any> {  
  return this.http.get(`http://localhost:3000/db/private/visits/externalDoctor?docId=${idDottore}`, {withCredentials:true});
}

  deleteVisita(idVisita:number):Observable<any>
  {
    return this.http.delete(`http://localhost:3000/db/private/delVisit?id=${idVisita}`, {withCredentials:true}) //aggiungi percorso
  }

  log_out():Observable<any>
  {
    return this.http.post('http://localhost:3000/session/logout', null, {withCredentials:true})
  }

  updateVisita(body: { data: string, ora: string, idVisita: number }): Observable<any> {
  return this.http.patch('http://localhost:3000/db/private/modVisit', body,{withCredentials:true} );
}

    getTuttiUtenti():Observable<any>
    {
      return this.http.get<any[]>('http://localhost:3000/db/private/users', {withCredentials:true});
    }

  getVisitePaziente(): Observable<any[]> {
  return this.http.get<any[]>('http://localhost:3000/db/private/visits/user', {withCredentials:true}); 
}

getVisitePazienteId(id:number): Observable<any[]> {
  return this.http.get<any[]>(`http://localhost:3000/db/private/visits/externalUser?usrId=${id}`, {withCredentials:true}); 
}


}
